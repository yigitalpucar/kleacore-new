import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getInvoiceById } from "@/lib/dal/invoices";
import { InvoiceDetailContent, type AdminInvoiceDetail } from "./content";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Fatura detayı" };

export default async function InvoiceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const invoice = await getInvoiceById(id);
  if (!invoice) return notFound();

  const data: AdminInvoiceDetail = {
    id: invoice.id,
    invoiceNumber: invoice.invoiceNumber,
    status: invoice.status,
    subtotal: Number(invoice.subtotal),
    taxRate: Number(invoice.taxRate),
    taxAmount: Number(invoice.taxAmount),
    totalAmount: Number(invoice.totalAmount),
    paidAmount: Number(invoice.paidAmount),
    createdAt: invoice.createdAt.toISOString(),
    issuedAt: invoice.issuedAt.toISOString(),
    dueDate: invoice.dueDate.toISOString(),
    paidAt: invoice.paidAt ? invoice.paidAt.toISOString() : null,
    notes: invoice.notes,
    customer: invoice.customer,
    order: invoice.order,
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
      notes: p.notes,
      paidAt: p.paidAt ? p.paidAt.toISOString() : null,
      createdAt: p.createdAt.toISOString(),
    })),
    eInvoice: invoice.eInvoiceRecord
      ? {
          status: invoice.eInvoiceRecord.status,
          type: invoice.eInvoiceRecord.type,
          documentNumber: invoice.eInvoiceRecord.documentNumber,
          sentAt: invoice.eInvoiceRecord.sentAt ? invoice.eInvoiceRecord.sentAt.toISOString() : null,
          errorMessage: invoice.eInvoiceRecord.errorMessage,
          attempts: invoice.eInvoiceRecord.attempts,
          pdfAvailable:
            Boolean(invoice.eInvoiceRecord.documentUuid) &&
            invoice.eInvoiceRecord.provider !== "parasut" &&
            ["SENT", "ACCEPTED", "CANCELLED"].includes(invoice.eInvoiceRecord.status),
        }
      : null,
  };

  return <InvoiceDetailContent invoice={data} />;
}
