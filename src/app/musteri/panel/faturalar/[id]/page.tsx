import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { getInvoiceById } from "@/lib/dal/invoices";
import { getKuveytTurkFailureMessage } from "@/lib/integrations/payment-gateways/providers/kuveytturk-flow";
import { getCustomerPaymentOptions } from "@/lib/payments/payment-options";
import { getSavedCardAvailability, listChargeableCards } from "@/lib/payments/saved-cards";
import { getBankAccounts, getInvoiceBankTransferNotices } from "@/lib/dal/bank-transfer";
import { FaturaDetayContent, type InvoicePaymentNotice } from "./content";

import { WaitingOrdersNotice } from "@/components/panel/waiting-orders-notice";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Fatura detayı" };

interface FaturaDetayPageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ payment?: string; odeme?: string }>;
}

async function buildPaymentNotice(
  outcome: string | undefined,
  invoiceId: string,
  invoiceStatus: string,
  customerId: string
): Promise<InvoicePaymentNotice | null> {
  if (outcome === "success" && invoiceStatus === "PAID") {
    return { tone: "success", title: "Ödemeniz alındı", message: "Faturanız ödendi olarak işaretlendi." };
  }
  if (outcome === "failed") {
    const bankMessage = await getKuveytTurkFailureMessage({ invoiceId }, customerId);
    return {
      tone: "error",
      title: "Ödeme tamamlanmadı",
      message: bankMessage
        ? `Banka yanıtı: ${bankMessage} Kartınızdan çekim yapılmadı; tekrar deneyebilirsiniz.`
        : "Ödeme onaylanmadı. Kartınızdan çekim yapılmadı; tekrar deneyebilirsiniz.",
    };
  }
  if (outcome === "review" || (outcome === "success" && invoiceStatus !== "PAID")) {
    return {
      tone: "warning",
      title: "Ödemeniz kontrol ediliyor",
      message:
        "Banka yanıtı doğrulanıyor. Kartınızdan çekim yapıldıysa faturanız kısa sürede güncellenecek; lütfen tekrar ödeme yapmayın.",
    };
  }
  return null;
}

export default async function FaturaDetayPage(props: FaturaDetayPageProps) {
  const params = await props.params;
  const { payment: paymentOutcome, odeme } = await props.searchParams;
  const session = await auth();
  const invoice = await getInvoiceById(params.id);

  if (!invoice) {
    notFound();
  }

  // Only the invoice owner may see it (prevents IDOR via guessed ids).
  if (invoice.customerId !== session?.user?.id) {
    notFound();
  }

  const serializedInvoice = {
    id: invoice.id,
    invoiceNumber: invoice.invoiceNumber,
    status: invoice.status,
    subtotal: Number(invoice.subtotal),
    taxRate: Number(invoice.taxRate),
    taxAmount: Number(invoice.taxAmount),
    totalAmount: Number(invoice.totalAmount),
    paidAmount: Number(invoice.paidAmount),
    refundedAmount: Number(invoice.refundedAmount),
    issuedAt: invoice.issuedAt.toISOString(),
    dueDate: invoice.dueDate.toISOString(),
    paidAt: invoice.paidAt ? invoice.paidAt.toISOString() : null,
    notes: invoice.notes,
    items: invoice.items.map((item) => ({
      id: item.id,
      description: item.description,
      quantity: item.quantity,
      unitPrice: Number(item.unitPrice),
      discountAmount: Number(item.discountAmount),
      totalPrice: Number(item.totalPrice),
    })),
    payments: invoice.payments.map((p) => ({
      id: p.id,
      amount: Number(p.amount),
      method: p.method,
      status: p.status,
      transactionId: p.transactionId,
      paidAt: p.paidAt ? p.paidAt.toISOString() : null,
    })),
    customer: {
      id: invoice.customer.id,
      name: invoice.customer.name,
      surname: invoice.customer.surname,
      email: invoice.customer.email,
      phone: invoice.customer.phone,
      companyName: invoice.customer.companyName,
      taxNumber: invoice.customer.taxNumber,
      taxOffice: invoice.customer.taxOffice,
      address: invoice.customer.address,
      city: invoice.customer.city,
      country: invoice.customer.country,
    },
    order: invoice.order
      ? { id: invoice.order.id, orderNumber: invoice.order.orderNumber }
      : null,
    eInvoice: invoice.eInvoiceRecord
      ? {
          status: invoice.eInvoiceRecord.status,
          type: invoice.eInvoiceRecord.type,
          documentNumber: invoice.eInvoiceRecord.documentNumber,
          sentAt: invoice.eInvoiceRecord.sentAt
            ? invoice.eInvoiceRecord.sentAt.toISOString()
            : null,
          errorMessage: invoice.eInvoiceRecord.errorMessage,
          pdfAvailable:
            Boolean(invoice.eInvoiceRecord.documentUuid) &&
            invoice.eInvoiceRecord.provider !== "parasut" &&
            ["SENT", "ACCEPTED"].includes(invoice.eInvoiceRecord.status),
        }
      : null,
  };

  const paymentNotice = await buildPaymentNotice(
    paymentOutcome,
    invoice.id,
    invoice.status,
    invoice.customerId
  );

  const canPay = invoice.status === "PENDING" || invoice.status === "OVERDUE";
  const [paymentOptions, bankAccounts, bankTransferNotices, savedCards] = await Promise.all([
    canPay ? getCustomerPaymentOptions(invoice.customerId) : null,
    canPay ? getBankAccounts({ activeOnly: true }) : [],
    getInvoiceBankTransferNotices(invoice.id),
    canPay
      ? getSavedCardAvailability().then((availability) =>
          availability.available ? listChargeableCards(invoice.customerId) : []
        )
      : [],
  ]);

  return (
    <>
      {invoice.status === "PAID" ? <WaitingOrdersNotice userId={invoice.customerId} /> : null}
      <FaturaDetayContent
        invoice={serializedInvoice}
        paymentNotice={paymentNotice}
        paymentOptions={paymentOptions}
        bankAccounts={bankAccounts}
        bankTransferNotices={bankTransferNotices}
        initialMethod={odeme === "havale" ? "bank_transfer" : null}
        savedCards={savedCards}
      />
    </>
  );
}
