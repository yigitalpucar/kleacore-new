import { auth } from "@/lib/auth";
import { getInvoicesByCustomer } from "@/lib/dal/invoices";
import { FaturalarContent } from "./content";

export const dynamic = "force-dynamic";

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
  }));

  // Compute stats server-side
  const stats = {
    total: serializedInvoices.reduce((sum, inv) => sum + inv.totalAmount, 0),
    pending: serializedInvoices
      .filter((i) => i.status === "PENDING")
      .reduce((sum, inv) => sum + inv.totalAmount, 0),
    overdue: serializedInvoices
      .filter((i) => i.status === "OVERDUE")
      .reduce((sum, inv) => sum + inv.totalAmount, 0),
  };

  return <FaturalarContent invoices={serializedInvoices} stats={stats} />;
}
