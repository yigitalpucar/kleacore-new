import { notFound } from "next/navigation";
import { getCustomerById } from "@/lib/dal/customers";
import { CustomerDetailContent } from "./content";

export const dynamic = "force-dynamic";

export default async function CustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const customer = await getCustomerById(id);

  if (!customer) return notFound();

  return <CustomerDetailContent customer={customer as any} />;
}
