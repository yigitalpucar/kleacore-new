import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { getInvoiceById } from "@/lib/dal/invoices";
import { FaturaDetayContent } from "./content";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Fatura detayı" };

interface FaturaDetayPageProps {
  params: Promise<{ id: string }>;
}

export default async function FaturaDetayPage(props: FaturaDetayPageProps) {
  const params = await props.params;
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
    issuedAt: invoice.issuedAt.toISOString(),
    dueDate: invoice.dueDate.toISOString(),
    paidAt: invoice.paidAt ? invoice.paidAt.toISOString() : null,
    notes: invoice.notes,
    items: invoice.items.map((item) => ({
      id: item.id,
      description: item.description,
      quantity: item.quantity,
      unitPrice: Number(item.unitPrice),
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
        }
      : null,
  };

  return <FaturaDetayContent invoice={serializedInvoice} />;
}
