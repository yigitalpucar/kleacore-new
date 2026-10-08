import type { Metadata } from "next";
import { auth } from "@/lib/auth";
import { getInvoicesByCustomer } from "@/lib/dal/invoices";
import { max, sub, sum, toNumber } from "@/lib/money";
import { FaturalarContent } from "./content";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Faturalarım" };

export default async function FaturalarPage() {
  const session = await auth();
  const userId = session!.user.id;

  const invoices = await getInvoicesByCustomer(userId);

  const serializedInvoices = invoices.map((inv) => ({
    id: inv.id,
    invoiceNumber: inv.invoiceNumber,
    status: inv.status,
    totalAmount: Number(inv.totalAmount),
    paidAmount: Number(inv.paidAmount),
    dueDate: inv.dueDate.toISOString(),
    paidAt: inv.paidAt ? inv.paidAt.toISOString() : null,
    createdAt: inv.createdAt.toISOString(),
    items: inv.items.map((item) => ({
      id: item.id,
      description: item.description,
      quantity: item.quantity,
      unitPrice: Number(item.unitPrice),
      totalPrice: Number(item.totalPrice),
    })),
    eInvoice: inv.eInvoiceRecord
      ? {
          status: inv.eInvoiceRecord.status,
          type: inv.eInvoiceRecord.type,
          sentAt: inv.eInvoiceRecord.sentAt
            ? inv.eInvoiceRecord.sentAt.toISOString()
            : null,
        }
      : null,
  }));

  const outstandingTotal = (statuses: string[]) =>
    toNumber(
      sum(
        invoices
          .filter((inv) => statuses.includes(inv.status))
          .map((inv) => max(0, sub(inv.totalAmount, inv.paidAmount)))
      )
    );

  const stats = {
    outstanding: outstandingTotal(["PENDING", "OVERDUE"]),
    pending: outstandingTotal(["PENDING"]),
    overdue: outstandingTotal(["OVERDUE"]),
  };

  return <FaturalarContent invoices={serializedInvoices} stats={stats} />;
}
