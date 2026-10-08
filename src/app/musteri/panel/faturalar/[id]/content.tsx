"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, Check, CreditCard, Download, Loader2, Mail, Printer } from "lucide-react";
import {
  AppBreadcrumbLabel,
  DetailList,
  PageHeader,
  SectionCard,
  StatusBadge,
  appButton,
  enumLabel,
  getStatusMeta,
} from "@/components/app";
import { getCustomerEInvoiceLabel } from "@/lib/efatura/customer-status";
import type { EInvoiceStatus } from "@prisma/client";
import { cn } from "@/lib/utils";
import { formatTRY } from "@/lib/format/price";
import { formatDate, formatDateTime } from "@/lib/format/date";
import { handleCreditCardCheckoutRedirect } from "@/lib/payments/checkout-redirect";
import { payInvoice, sendInvoiceCopy } from "@/lib/actions/customer/invoices";
import { toast } from "@/lib/toast";
import { PaymentMethodPicker } from "@/components/checkout/payment-method-picker";
import type { CustomerPaymentOptions } from "@/lib/payments/payment-options";
import type { BankAccountView, BankTransferNoticeView } from "@/lib/dal/bank-transfer";
import type { SavedCardView } from "@/lib/payments/saved-cards";
import { BankTransferPanel } from "./bank-transfer-panel";
import { SavedCardPayPanel } from "./saved-card-pay-panel";

interface SerializedInvoice {
  id: string;
  invoiceNumber: string;
  status: string;
  subtotal: number;
  taxRate: number;
  taxAmount: number;
  totalAmount: number;
  paidAmount: number;
  refundedAmount: number;
  issuedAt: string;
  dueDate: string;
  paidAt: string | null;
  notes: string | null;
  items: {
    id: string;
    description: string;
    quantity: number;
    unitPrice: number;
    discountAmount: number;
    totalPrice: number;
  }[];
  payments: {
    id: string;
    amount: number;
    method: string;
    status: string;
    transactionId: string | null;
    paidAt: string | null;
  }[];
  customer: {
    id: string;
    name: string;
    surname: string;
    email: string;
    phone: string | null;
    companyName: string | null;
    taxNumber: string | null;
    taxOffice: string | null;
    address: string | null;
    city: string | null;
    country: string | null;
  };
  order: {
    id: string;
    orderNumber: string;
  } | null;
  eInvoice: {
    status: string;
    type: string;
    documentNumber: string | null;
    sentAt: string | null;
    errorMessage: string | null;
    pdfAvailable: boolean;
  } | null;
}

export interface InvoicePaymentNotice {
  tone: "success" | "error" | "warning";
  title: string;
  message: string;
}

interface FaturaDetayContentProps {
  invoice: SerializedInvoice;
  paymentNotice?: InvoicePaymentNotice | null;
  paymentOptions?: CustomerPaymentOptions | null;
  bankAccounts?: BankAccountView[];
  bankTransferNotices?: BankTransferNoticeView[];
  initialMethod?: string | null;
  /** Chargeable stored cards ("Kayıtlı kartla öde"); empty when saved cards are off. */
  savedCards?: SavedCardView[];
}

const money = (n: number) => formatTRY(n, { keepDecimals: true });

export function FaturaDetayContent({
  invoice,
  paymentNotice,
  paymentOptions,
  bankAccounts = [],
  bankTransferNotices = [],
  initialMethod,
  savedCards = [],
}: FaturaDetayContentProps) {
  const router = useRouter();
  const canPay = invoice.status === "PENDING" || invoice.status === "OVERDUE";
  const description = invoice.items[0]?.description ?? invoice.invoiceNumber;
  const lastPayment = invoice.payments[0];
  const invoicePdfUrl = `/api/faturalar/${invoice.id}/pdf`;
  const officialPdfUrl =
    invoice.status === "PAID" && invoice.eInvoice?.pdfAvailable ? `/api/faturalar/${invoice.id}/e-belge` : null;
  const outstanding = Math.max(invoice.totalAmount - invoice.paidAmount, 0);
  const [isPaying, setIsPaying] = useState(false);
  const [isSendingCopy, setIsSendingCopy] = useState(false);
  const allOptions = [...(paymentOptions?.options ?? []), ...(paymentOptions?.otherCards ?? [])];
  const [paymentMethod, setPaymentMethod] = useState<string | null>(
    initialMethod && allOptions.some((option) => option.id === initialMethod)
      ? initialMethod
      : (paymentOptions?.defaultMethod ?? null)
  );
  const selectedKind = allOptions.find((option) => option.id === paymentMethod)?.kind;
  const isBankTransfer = selectedKind === "bank_transfer";
  const hasPendingNotice = bankTransferNotices.some((notice) => notice.status === "PENDING");
  const payLabel = selectedKind === "balance" ? "Bakiyeden öde" : "Şimdi öde";

  const handlePayInvoice = async () => {
    if (isBankTransfer) {
      document.getElementById("odeme")?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    if (isPaying || !paymentMethod) return;
    setIsPaying(true);

    const result = await payInvoice({
      invoiceId: invoice.id,
      paymentMethod,
    });

    if (!result.success) {
      toast.error(result.error ?? "Ödeme tamamlanamadı");
      setIsPaying(false);
      return;
    }

    if (
      result.data &&
      handleCreditCardCheckoutRedirect(
        {
          checkoutUrl: result.data.checkoutUrl,
          checkoutHtml: result.data.checkoutHtml,
          paytrToken: result.data.paytrToken,
        },
        router
      )
    ) {
      return;
    }

    toast.success(result.message ?? "Ödeme tamamlandı");
    router.refresh();
    setIsPaying(false);
  };

  const handleSendInvoiceCopy = async () => {
    if (isSendingCopy) return;
    setIsSendingCopy(true);

    const result = await sendInvoiceCopy(invoice.id);
    if (!result.success) {
      toast.error(result.error ?? "Fatura özeti gönderilemedi");
      setIsSendingCopy(false);
      return;
    }

    toast.success(result.message ?? "Fatura özeti gönderildi");
    setIsSendingCopy(false);
  };

  const customerName = `${invoice.customer.name} ${invoice.customer.surname}`.trim();

  return (
    <>
      <AppBreadcrumbLabel segment={invoice.id} label={invoice.invoiceNumber} />

      <PageHeader
        back={{ href: "/musteri/panel/faturalar", label: "Faturalarım" }}
        eyebrow="Fatura"
        title={<span className="font-mono tracking-normal">{invoice.invoiceNumber}</span>}
        description={description}
        meta={
          <>
            <StatusBadge kind="invoice" status={invoice.status} size="md" />
            {invoice.status === "PAID" && invoice.eInvoice ? (
              <StatusBadge
                size="md"
                tone={getStatusMeta("eInvoice", invoice.eInvoice.status).tone}
                label={getCustomerEInvoiceLabel(
                  invoice.eInvoice.status as EInvoiceStatus,
                  invoice.eInvoice.type as "e-fatura" | "e-arsiv"
                )}
              />
            ) : null}
            <span>Düzenlenme {formatDate(invoice.issuedAt)}</span>
            <span>Son ödeme {formatDate(invoice.dueDate)}</span>
          </>
        }
        actions={
          <>
            <button
              type="button"
              onClick={() => window.open(invoicePdfUrl, "_blank")}
              className={appButton({ variant: "outline" })}
            >
              <Download aria-hidden />
              PDF
            </button>
            <button
              type="button"
              onClick={() => window.print()}
              aria-label="Yazdır"
              className={appButton({ variant: "outline", size: "icon" })}
            >
              <Printer aria-hidden />
            </button>
            {canPay && paymentMethod && !hasPendingNotice ? (
              <button type="button" onClick={handlePayInvoice} disabled={isPaying} className={appButton()}>
                {isPaying ? <Loader2 aria-hidden className="animate-spin" /> : <CreditCard aria-hidden />}
                {isPaying ? "İşleniyor…" : isBankTransfer ? "Havale bilgileri" : payLabel}
              </button>
            ) : null}
          </>
        }
      />

      {paymentNotice ? (
        <div
          role={paymentNotice.tone === "success" ? "status" : "alert"}
          className={cn(
            "flex items-start gap-3 rounded-lg border bg-card p-4 text-sm",
            paymentNotice.tone === "success"
              ? "border-emerald-500/40"
              : paymentNotice.tone === "error"
                ? "border-red-500/40"
                : "border-amber-500/40"
          )}
        >
          {paymentNotice.tone === "success" ? (
            <Check aria-hidden className="mt-0.5 size-4 shrink-0 text-emerald-500" />
          ) : (
            <AlertTriangle
              aria-hidden
              className={cn(
                "mt-0.5 size-4 shrink-0",
                paymentNotice.tone === "error" ? "text-red-500" : "text-amber-500"
              )}
            />
          )}
          <div>
            <p className="font-medium">{paymentNotice.title}</p>
            <p className="mt-0.5 text-muted-foreground">{paymentNotice.message}</p>
          </div>
        </div>
      ) : null}

      {invoice.status === "OVERDUE" ? (
        <div role="alert" className="flex items-start gap-3 rounded-lg border border-red-500/40 bg-card p-4 text-sm">
          <AlertTriangle aria-hidden className="mt-0.5 size-4 shrink-0 text-red-500" />
          <div>
            <p className="font-medium">Ödeme gecikmiş</p>
            <p className="mt-0.5 text-muted-foreground">
              Bu faturanın son ödeme tarihi geçti. Hizmetinizin askıya alınmaması için lütfen en kısa sürede ödeme yapın.
            </p>
          </div>
        </div>
      ) : null}

      <div className="grid items-start gap-6 lg:grid-cols-3">
        <div className="min-w-0 space-y-6 lg:col-span-2">
          <SectionCard title="Fatura kalemleri" flush>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <caption className="sr-only">Fatura kalemleri</caption>
                <thead>
                  <tr className="border-b bg-muted/30 text-left font-mono text-[11px] uppercase tracking-[0.1em] text-muted-foreground">
                    <th scope="col" className="h-10 px-4 font-medium md:px-5">Açıklama</th>
                    <th scope="col" className="hidden h-10 px-4 text-right font-medium sm:table-cell">Adet</th>
                    <th scope="col" className="hidden h-10 px-4 text-right font-medium sm:table-cell">Birim fiyat</th>
                    <th scope="col" className="h-10 px-4 text-right font-medium md:px-5">Tutar (KDV hariç)</th>
                  </tr>
                </thead>
                <tbody>
                  {invoice.items.map((item) => (
                    <tr key={item.id} className="border-b border-dashed last:border-0">
                      <td className="px-4 py-3 md:px-5">
                        <p className="font-medium">{item.description}</p>
                        <p className="text-xs text-muted-foreground sm:hidden">
                          {item.quantity} × {money(item.unitPrice)}
                        </p>
                        {item.discountAmount > 0 ? (
                          <p className="text-xs text-muted-foreground">İndirim: −{money(item.discountAmount)}</p>
                        ) : null}
                      </td>
                      <td className="hidden px-4 py-3 text-right tabular-nums text-muted-foreground sm:table-cell">{item.quantity}</td>
                      <td className="hidden px-4 py-3 text-right tabular-nums text-muted-foreground sm:table-cell">{money(item.unitPrice)}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-right font-medium tabular-nums md:px-5">{money(item.totalPrice)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="border-t px-4 py-4 md:px-5">
              <dl className="ml-auto max-w-xs space-y-2 text-sm">
                <div className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">Ara toplam</dt>
                  <dd className="tabular-nums">{money(invoice.subtotal)}</dd>
                </div>
                {invoice.taxAmount > 0 ? (
                  <div className="flex justify-between gap-4">
                    <dt className="text-muted-foreground">KDV (%{invoice.taxRate})</dt>
                    <dd className="tabular-nums">{money(invoice.taxAmount)}</dd>
                  </div>
                ) : null}
                <div className="flex justify-between gap-4 border-t border-dashed pt-2 text-base font-semibold">
                  <dt>Toplam</dt>
                  <dd className="tabular-nums">{money(invoice.totalAmount)}</dd>
                </div>
                {invoice.paidAmount > 0 && canPay ? (
                  <div className="flex justify-between gap-4 text-muted-foreground">
                    <dt>Kalan</dt>
                    <dd className="tabular-nums">{money(outstanding)}</dd>
                  </div>
                ) : null}
              </dl>
            </div>
          </SectionCard>

          {invoice.status === "PAID" && lastPayment ? (
            <SectionCard title="Ödeme bilgileri" actions={<StatusBadge kind="payment" status={lastPayment.status} />}>
              <DetailList
                layout="grid"
                columns={3}
                items={[
                  { label: "Ödeme yöntemi", value: enumLabel("paymentMethod", lastPayment.method) },
                  { label: "Ödeme tarihi", value: formatDateTime(invoice.paidAt ?? lastPayment.paidAt) },
                  { label: "Tutar", value: money(lastPayment.amount) },
                  { label: "İşlem numarası", value: lastPayment.transactionId, mono: true, copy: lastPayment.transactionId ?? undefined },
                ]}
              />
            </SectionCard>
          ) : null}

          <SectionCard title="Fatura adresi">
            <div className="grid gap-6 sm:grid-cols-2">
              <div className="space-y-0.5 text-sm">
                <p className="font-medium">{customerName}</p>
                {invoice.customer.companyName ? <p className="text-muted-foreground">{invoice.customer.companyName}</p> : null}
                {invoice.customer.address ? <p className="pt-1.5 text-muted-foreground">{invoice.customer.address}</p> : null}
                {invoice.customer.city || invoice.customer.country ? (
                  <p className="text-muted-foreground">
                    {[invoice.customer.city, invoice.customer.country].filter(Boolean).join(", ")}
                  </p>
                ) : null}
              </div>
              <DetailList
                items={[
                  { label: "Vergi no", value: invoice.customer.taxNumber },
                  { label: "Vergi dairesi", value: invoice.customer.taxOffice },
                  { label: "E-posta", value: invoice.customer.email },
                ]}
              />
            </div>
            <p className="mt-4 text-xs text-muted-foreground">
              Fatura bilgilerinizi{" "}
              <Link href="/musteri/panel/ayarlar" className="font-medium text-foreground underline-offset-4 hover:underline">
                hesap ayarlarından
              </Link>{" "}
              güncelleyebilirsiniz.
            </p>
          </SectionCard>

          {invoice.notes ? (
            <SectionCard title="Not">
              <p className="whitespace-pre-line text-sm text-muted-foreground">{invoice.notes}</p>
            </SectionCard>
          ) : null}
        </div>

        <div className="space-y-6">
          <SectionCard title="Özet">
            <DetailList
              items={[
                { label: "Fatura no", value: invoice.invoiceNumber, mono: true },
                { label: "Düzenlenme", value: formatDate(invoice.issuedAt) },
                { label: "Son ödeme", value: formatDate(invoice.dueDate) },
                { label: "Durum", value: <StatusBadge kind="invoice" status={invoice.status} /> },
                {
                  label: "E-belge no",
                  value: invoice.status === "PAID" ? invoice.eInvoice?.documentNumber : null,
                  mono: true,
                },
                { label: "İlgili sipariş", value: invoice.order?.orderNumber, mono: true },
              ]}
            />
            <div className="mt-4 flex items-baseline justify-between gap-3 border-t pt-4">
              <span className="text-sm font-medium">{canPay ? "Ödenecek tutar" : "Toplam"}</span>
              <span className="text-xl font-semibold tabular-nums tracking-tight">
                {money(canPay ? outstanding : invoice.totalAmount)}
              </span>
            </div>

            {invoice.refundedAmount > 0 ? (
              <div className="mt-3 flex items-baseline justify-between gap-3 text-sm text-muted-foreground">
                <span>İade edilen</span>
                <span className="tabular-nums">{money(invoice.refundedAmount)}</span>
              </div>
            ) : null}

            {canPay && paymentOptions ? (
              <div id="odeme" className="mt-5 scroll-mt-24 space-y-3">
                {!hasPendingNotice ? (
                  <SavedCardPayPanel invoiceId={invoice.id} outstanding={outstanding} cards={savedCards} />
                ) : null}
                <PaymentMethodPicker
                  options={paymentOptions.options}
                  otherCards={paymentOptions.otherCards}
                  value={paymentMethod}
                  onChange={setPaymentMethod}
                  payableAmount={outstanding}
                  balance={paymentOptions.balance}
                  name="invoice-payment-method"
                />
                {isBankTransfer ? (
                  <BankTransferPanel
                    invoiceId={invoice.id}
                    invoiceNumber={invoice.invoiceNumber}
                    outstanding={outstanding}
                    defaultSenderName={invoice.customer.companyName || customerName}
                    bankAccounts={bankAccounts}
                    notices={bankTransferNotices}
                  />
                ) : paymentMethod ? (
                  <button
                    type="button"
                    onClick={handlePayInvoice}
                    disabled={isPaying}
                    className={appButton({ className: "w-full md:h-10" })}
                  >
                    {isPaying ? <Loader2 aria-hidden className="animate-spin" /> : <CreditCard aria-hidden />}
                    {isPaying ? "İşleniyor…" : selectedKind === "balance" ? "Bakiyeden öde" : "Ödeme yap"}
                  </button>
                ) : null}
              </div>
            ) : null}
          </SectionCard>

          <SectionCard title="İşlemler">
            <div className="grid gap-2">
              {officialPdfUrl ? (
                <a href={officialPdfUrl} className={appButton({ className: "justify-start" })}>
                  <Download aria-hidden />
                  Resmi faturayı indir
                </a>
              ) : null}
              <button
                type="button"
                onClick={() => window.open(invoicePdfUrl, "_blank")}
                className={appButton({ variant: "outline", className: "justify-start" })}
              >
                <Download aria-hidden />
                PDF indir
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className={appButton({ variant: "outline", className: "justify-start" })}
              >
                <Printer aria-hidden />
                Yazdır
              </button>
              <button
                type="button"
                onClick={handleSendInvoiceCopy}
                disabled={isSendingCopy}
                className={appButton({ variant: "outline", className: "justify-start" })}
              >
                {isSendingCopy ? <Loader2 aria-hidden className="animate-spin" /> : <Mail aria-hidden />}
                {isSendingCopy ? "Gönderiliyor…" : "E-posta ile gönder"}
              </button>
            </div>
          </SectionCard>

          <div className="rounded-lg border border-dashed p-4 text-sm">
            <p className="font-medium">Ödemeyle ilgili bir sorun mu var?</p>
            <p className="mt-1 text-muted-foreground">Fatura ile ilgili sorularınız için destek ekibimize yazabilirsiniz.</p>
            <Link href="/musteri/panel/destek/yeni" className={appButton({ variant: "ghost", size: "sm", className: "-ml-2.5 mt-2" })}>
              Destek talebi oluştur
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}
