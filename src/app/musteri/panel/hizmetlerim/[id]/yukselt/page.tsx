import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { getPlanChangeOptionsForService } from "@/lib/services/plan-change";
import { ServicePlanChangeContent } from "./content";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function ServicePlanChangePage(props: Props) {
  const params = await props.params;
  const session = await auth();
  const userId = session!.user.id;

  const options = await getPlanChangeOptionsForService(params.id, userId);

  if (!options) {
    notFound();
  }

  const { service, upgrades, downgrades } = options;

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
      sku: service.product.sku,
      displayOrder: service.product.displayOrder,
      category: service.product.category
        ? { slug: service.product.category.slug, name: service.product.category.name }
        : null,
    },
    upgrades: upgrades.map((item) => ({
      id: item.product.id,
      name: item.product.name,
      sku: item.product.sku,
      shortDescription: item.product.shortDescription,
      basePrice: Number(item.product.basePrice),
      displayOrder: item.product.displayOrder,
      proratedAmount: item.proration.proratedAmount,
      newPrice: item.proration.newPrice,
      priceDiff: item.proration.priceDiff,
      remainingDays: item.proration.remainingDays,
    })),
    downgrades: downgrades.map((item) => ({
      id: item.product.id,
      name: item.product.name,
      sku: item.product.sku,
      shortDescription: item.product.shortDescription,
      basePrice: Number(item.product.basePrice),
      displayOrder: item.product.displayOrder,
      proratedAmount: item.proration.proratedAmount,
      newPrice: item.proration.newPrice,
      priceDiff: item.proration.priceDiff,
      remainingDays: item.proration.remainingDays,
    })),
  };

  return <ServicePlanChangeContent service={serialized} />;
}