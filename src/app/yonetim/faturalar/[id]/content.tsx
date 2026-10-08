"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Banknote, CheckCircle, Download, Mail, Printer, XCircle } from "lucide-react";
import {
  AppBreadcrumbLabel,
  DetailList,
  EmptyState,
  PageHeader,
  SectionCard,
  StatusBadge,
  appButton,
  enumLabel,
} from "@/components/app";
import {
  approveBankTransfer,
  cancelInvoice,
  markPaid,
  sendInvoiceReceipt,
  sendInvoiceReminder,
} from "@/lib/actions/admin/invoices";
import { formatDate, formatDateTime } from "@/lib/format/date";
import { formatTRY } from "@/lib/format/price";
import { toast } from "@/lib/toast";
import { issueEInvoiceForInvoiceAction } from "@/lib/actions/admin/efatura";

export interface AdminInvoiceDetail {
  id: string;
  invoiceNumber: string;
  status: string;
  subtotal: number;
  taxRate: number;
  taxAmount: number;
  totalAmount: number;
  paidAmount: number;
  createdAt: string;
  issuedAt: string;
  dueDate: string;
  paidAt: string | null;
  notes: string | null;
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
  order: { id: string; orderNumber: string } | null;
  items: { id: string; description: string; quantity: number; unitPrice: number; totalPrice: number }[];
  payments: {
    id: string;
    amount: number;
    method: string;
    status: string;
    transactionId: string | null;
    notes: string | null;
    paidAt: string | null;
    createdAt: string;
  }[];
  eInvoice: {
    status: string;
    type: string;
    documentNumber: string | null;
    sentAt: string | null;
    errorMessage: string | null;
    attempts: number;
    pdfAvailable: boolean;
  } | null;
}

const money = (n: number) => formatTRY(n, { keepDecimals: true });

export function InvoiceDetailContent({ invoice }: { invoice: AdminInvoiceDetail }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const isOpen = invoice.status === "PENDING" || invoice.status === "OVERDUE";
  const isPaid = invoice.status === "PAID";
  const customerName = `${invoice.customer.name} ${invoice.customer.surname}`.trim();
  const outstanding = Math.max(0, invoice.totalAmount - invoice.paidAmount);
  const hasPendingBankTransfer = invoice.payments.some(
    (payment) => payment.method === "BANK_TRANSFER" && payment.status === "PENDING"
  );

  const run = async (
    key: string,
    action: () => Promise<{ success: boolean; error?: string; message?: string }>,
    messages: { ok: string; fail: string },
    refresh = true
  ) => {
    setBusy(key);
    const result = await action();
    setBusy(null);
    if (!result.success) {
      toast.error(result.error ?? messages.fail);
      return;
    }
    toast.success(result.message ?? messages.ok);
    if (refresh) router.refresh();
  };

  const handleApproveBankTransfer = () =>
    run("approve", () => approveBankTransfer(invoice.id), {
      ok: "Banka transferi onaylandı ve sipariş işleme alındı",
      fail: "Banka transferi onaylanamadı",
    });

  const handleMarkPaid = () =>
    run("paid", () => markPaid(invoice.id), {
      ok: "Fatura ödendi olarak işaretlendi",
      fail: "Fatura durumu güncellenemedi",
    });

  const handleCancelInvoice = () => {
    if (!window.confirm(`${invoice.invoiceNumber} numaralı fatura iptal edilsin mi?`)) return;
    void run("cancel", () => cancelInvoice(invoice.id), { ok: "Fatura iptal edildi", fail: "Fatura iptal edilemedi" });
  };

  const handleSendMail = () =>
    run(
      "mail",
      () => (isPaid ? sendInvoiceReceipt(invoice.id) : sendInvoiceReminder(invoice.id)),
      {
        ok: isPaid ? "Makbuz gönderildi" : "Hatırlatma gönderildi",
        fail: "E-posta gönderilemedi",
      },
      false
    );

  const mailLabel = isPaid ? "Makbuz gönder" : "Hatırlatma gönder";
  const canMail = isPaid || isOpen;

  return (
    <>
      <AppBreadcrumbLabel segment={invoice.id} label={invoice.invoiceNumber} />

      <PageHeader
        back={{ href: "/yonetim/faturalar", label: "Faturalar" }}
        eyebrow="Fatura"
        title={<span className="font-mono">{invoice.invoiceNumber}</span>}
        meta={
          <>
            <StatusBadge kind="invoice" status={invoice.status} size="md" />
            <span>Oluşturma {formatDate(invoice.createdAt)}</span>
            <span>Son ödeme {formatDate(invoice.dueDate)}</span>
          </>
        }
        actions={
          <>
            <button type="button" className={appButton({ variant: "outline" })} onClick={() => window.print()}>
              <Printer aria-hidden />
              Yazdır
            </button>
            <button
              type="button"
              className={appButton({ variant: "outline" })}
              onClick={() => window.open(`/api/faturalar/${invoice.id}/pdf`, "_blank", "noopener,noreferrer")}
            >
              <Download aria-hidden />
              PDF indir
            </button>
            {canMail ? (
              <button
                type="button"
                className={appButton({ variant: "outline" })}
                onClick={() => void handleSendMail()}
                disabled={busy !== null}
              >
                <Mail aria-hidden />
                {busy === "mail" ? "Gönderiliyor…" : mailLabel}
              </button>
            ) : null}
            {isOpen ? (
              hasPendingBankTransfer ? (
                <button
                  type="button"
                  className={appButton()}
                  onClick={() => void handleApproveBankTransfer()}
                  disabled={busy !== null}
                >
                  <Banknote aria-hidden />
                  {busy === "approve" ? "Onaylanıyor…" : "Havaleyi onayla"}
                </button>
              ) : (
                <button
                  type="button"
                  className={appButton()}
                  onClick={() => void handleMarkPaid()}
                  disabled={busy !== null}
                >
                  <CheckCircle aria-hidden />
                  {busy === "paid" ? "İşaretleniyor…" : "Ödendi olarak işaretle"}
                </button>
              )
            ) : null}
          </>
        }
      />

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
                    <th scope="col" className="h-10 px-4 text-right font-medium md:px-5">Tutar</th>
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
                      </td>
                      <td className="hidden px-4 py-3 text-right tabular-nums text-muted-foreground sm:table-cell">{item.quantity}</td>
                      <td className="hidden px-4 py-3 text-right tabular-nums text-muted-foreground sm:table-cell">
                        {money(item.unitPrice)}
                      </td>
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
                <div className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">KDV (%{invoice.taxRate})</dt>
                  <dd className="tabular-nums">{money(invoice.taxAmount)}</dd>
                </div>
                <div className="flex justify-between gap-4 border-t border-dashed pt-2 text-base font-semibold">
                  <dt>Toplam</dt>
                  <dd className="tabular-nums">{money(invoice.totalAmount)}</dd>
                </div>
                {invoice.paidAmount > 0 && !isPaid ? (
                  <div className="flex justify-between gap-4 text-muted-foreground">
                    <dt>Kalan</dt>
                    <dd className="tabular-nums">{money(outstanding)}</dd>
                  </div>
                ) : null}
              </dl>
            </div>
          </SectionCard>

          <SectionCard
            title="Ödeme geçmişi"
            description={invoice.payments.length ? `${invoice.payments.length} kayıt` : undefined}
            flush
          >
            {invoice.payments.length ? (
              <ul className="divide-y divide-dashed">
                {invoice.payments.map((payment) => (
                  <li key={payment.id} className="flex flex-wrap items-start justify-between gap-3 px-4 py-3.5 md:px-5">
                    <div className="min-w-0 space-y-1">
                      <p className="text-sm font-medium">{enumLabel("paymentMethod", payment.method)}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatDateTime(payment.paidAt ?? payment.createdAt)}
                        {payment.transactionId ? (
                          <>
                            {" · "}
                            <span className="font-mono">{payment.transactionId}</span>
                          </>
                        ) : null}
                      </p>
                      {payment.notes ? <p className="text-xs text-muted-foreground">{payment.notes}</p> : null}
                    </div>
                    <div className="flex flex-col items-end gap-1.5">
                      <span className="font-medium tabular-nums">{money(payment.amount)}</span>
                      <StatusBadge kind="payment" status={payment.status} />
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="p-4 md:p-5">
                <EmptyState compact title="Ödeme kaydı yok" description="Bu faturaya henüz bir ödeme bağlanmadı." />
              </div>
            )}
          </SectionCard>

          {invoice.eInvoice ? (
            <SectionCard
              title={invoice.eInvoice.type === "e-arsiv" ? "e-Arşiv fatura" : "e-Fatura"}
              actions={<StatusBadge kind="eInvoice" status={invoice.eInvoice.status} />}
              footer={
                <>
                  {invoice.eInvoice.pdfAvailable ? (
                    <a href={`/api/faturalar/${invoice.id}/e-belge`} className={appButton({ variant: "outline", size: "sm" })}>
                      <Download aria-hidden />
                      Resmi faturayı indir
                    </a>
                  ) : null}
                  <Link href="/yonetim/efatura" className={appButton({ variant: "outline", size: "sm" })}>
                    E-Fatura sayfasına git
                  </Link>
                </>
              }
            >
              <DetailList
                layout="grid"
                items={[
                  { label: "Belge no", value: invoice.eInvoice.documentNumber, mono: true, copy: invoice.eInvoice.documentNumber ?? undefined },
                  { label: "Gönderim", value: invoice.eInvoice.sentAt ? formatDateTime(invoice.eInvoice.sentAt) : null },
                  { label: "Hata", value: invoice.eInvoice.errorMessage },
                  { label: "Deneme", value: invoice.eInvoice.attempts ? String(invoice.eInvoice.attempts) : null },
                ]}
              />
            </SectionCard>
          ) : invoice.status === "PAID" ? (
            <SectionCard
              title="Resmi fatura"
              description="Bu fatura için henüz e-Fatura / e-Arşiv kesilmedi."
              footer={<IssueEInvoiceButton invoiceId={invoice.id} />}
            >
              <p className="text-sm text-muted-foreground">
                Müşterinin VKN/TCKN bilgisine göre e-Fatura veya e-Arşiv otomatik seçilir.
              </p>
            </SectionCard>
          ) : null}

          {invoice.notes ? (
            <SectionCard title="Not">
              <p className="whitespace-pre-wrap text-sm text-muted-foreground">{invoice.notes}</p>
            </SectionCard>
          ) : null}
        </div>

        <div className="space-y-6">
          <SectionCard title="Özet">
            <DetailList
              items={[
                { label: "Fatura no", value: invoice.invoiceNumber, mono: true, copy: invoice.invoiceNumber },
                { label: "Durum", value: <StatusBadge kind="invoice" status={invoice.status} /> },
                { label: "Toplam", value: money(invoice.totalAmount) },
                { label: "Ödenen", value: money(invoice.paidAmount) },
                { label: "Düzenleme", value: formatDate(invoice.issuedAt) },
                { label: "Son ödeme", value: formatDate(invoice.dueDate) },
                { label: "Ödeme tarihi", value: invoice.paidAt ? formatDate(invoice.paidAt) : null },
                {
                  label: "Sipariş",
                  value: invoice.order ? (
                    <Link href={`/yonetim/siparisler/${invoice.order.id}`} className="font-mono underline-offset-4 hover:underline">
                      {invoice.order.orderNumber}
                    </Link>
                  ) : null,
                },
              ]}
            />
          </SectionCard>

          <SectionCard
            title="Müşteri"
            footer={
              <Link href={`/yonetim/musteriler/${invoice.customer.id}`} className={appButton({ variant: "outline", size: "sm" })}>
                Müşteri kartını aç
              </Link>
            }
          >
            <DetailList
              items={[
                { label: "Ad soyad", value: customerName },
                { label: "Firma", value: invoice.customer.companyName },
                { label: "E-posta", value: invoice.customer.email, copy: invoice.customer.email },
                { label: "Telefon", value: invoice.customer.phone },
                {
                  label: "Vergi",
                  value: invoice.customer.taxNumber
                    ? `${invoice.customer.taxNumber}${invoice.customer.taxOffice ? ` · ${invoice.customer.taxOffice}` : ""}`
                    : null,
                },
                {
                  label: "Adres",
                  value: [invoice.customer.address, invoice.customer.city, invoice.customer.country].filter(Boolean).join(", ") || null,
                },
              ]}
            />
          </SectionCard>

          {isOpen ? (
            <SectionCard title="Tehlikeli işlemler">
              <p className="mb-3 text-sm text-muted-foreground">İptal edilen fatura tahsil edilemez ve müşteriye hatırlatma gönderilmez.</p>
              <button
                type="button"
                className={appButton({ variant: "destructive", className: "w-full" })}
                onClick={handleCancelInvoice}
                disabled={busy !== null}
              >
                <XCircle aria-hidden />
                {busy === "cancel" ? "İptal ediliyor…" : "Faturayı iptal et"}
              </button>
            </SectionCard>
          ) : null}
        </div>
      </div>
    </>
  );
}

function IssueEInvoiceButton({ invoiceId }: { invoiceId: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  const handleIssue = async () => {
    setPending(true);
    const result = await issueEInvoiceForInvoiceAction(invoiceId);
    setPending(false);
    if (!result.success) {
      toast.error(result.error ?? "E-fatura kesilemedi");
    } else {
      toast.success("E-belge kesildi");
    }
    router.refresh();
  };

  return (
    <button type="button" disabled={pending} onClick={handleIssue} className={appButton({ size: "sm" })}>
      {pending ? "Kesiliyor…" : "E-belge kes"}
    </button>
  );
}
