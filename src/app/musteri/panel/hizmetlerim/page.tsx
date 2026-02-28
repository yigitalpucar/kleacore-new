import { auth } from "@/lib/auth";
import { getServicesByCustomer } from "@/lib/dal/services";
import { HizmetlerimContent } from "./content";

export default async function HizmetlerimPage() {
  const session = await auth();
  const services = await getServicesByCustomer(session!.user.id);

  // Serialize dates for client component — keep the same shape content.tsx expects
  const serializedServices = services.map((s) => ({
    id: s.id,
    label: s.label,
    domain: s.domain,
    status: s.status,
    amount: Number(s.amount),
    billingPeriod: s.billingPeriod,
    nextDueDate: s.nextDueDate ? s.nextDueDate.toISOString() : null,
    createdAt: s.createdAt.toISOString(),
    product: {
      id: s.product.id,
      name: s.product.name,
      sku: s.product.sku,
      category: {
        slug: s.product.category?.slug ?? "hosting",
        name: s.product.category?.name ?? "Hosting",
      },
    },
  }));

  return <HizmetlerimContent services={serializedServices} />;
}
