import { getInvoiceById } from "@/lib/dal/invoices";
import { notFound } from "next/navigation";
import { InvoiceDetailContent } from "./content";

export default async function InvoiceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const invoice = await getInvoiceById(id);
  if (!invoice) return notFound();
  return <InvoiceDetailContent invoice={invoice} />;
}
