import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { getServiceById } from "@/lib/dal/services";
import { db } from "@/lib/db";
import { ServiceRenewalContent } from "./content";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function ServiceRenewalPage(props: Props) {
  const params = await props.params;
  const session = await auth();
  const userId = session!.user.id;

  const [service, user] = await Promise.all([
    getServiceById(params.id),
    db.user.findUnique({
      where: { id: userId },
      select: { balance: true },
    }),
  ]);

  if (!service || service.customerId !== userId) {
    notFound();
  }

  const serialized = {
    id: service.id,
    label: service.label,
    domain: service.domain,
    amount: Number(service.amount),
    billingPeriod: service.billingPeriod,
    nextDueDate: service.nextDueDate ? service.nextDueDate.toISOString() : null,
    expiresAt: service.expiresAt ? service.expiresAt.toISOString() : null,
    product: {
      id: service.product.id,
      name: service.product.name,
      category: service.product.category
        ? { slug: service.product.category.slug, name: service.product.category.name }
        : null,
    },
  };

  return <ServiceRenewalContent service={serialized} userBalance={Number(user?.balance ?? 0)} />;
}
