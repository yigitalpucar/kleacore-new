import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getServiceById } from "@/lib/dal/services";
import { HizmetDetayContent } from "./content";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Hizmet detayı" };

interface Props {
  params: Promise<{ id: string }>;
}

export default async function HizmetDetayPage(props: Props) {
  const params = await props.params;
  const session = await auth();
  const service = await getServiceById(params.id);

  // Not found or not owned by this customer
  if (!service || service.customerId !== session!.user.id) {
    notFound();
  }

  const pendingCancellation = await db.cancellationRequest.findFirst({
    where: {
      serviceId: params.id,
      customerId: session!.user.id,
      status: "PENDING",
    },
    select: {
      id: true,
      reason: true,
      createdAt: true,
    },
  });

  // Serialize for client component
  const serialized = {
    id: service.id,
    label: service.label,
    domain: service.domain,
    status: service.status,
    amount: Number(service.amount),
    billingPeriod: service.billingPeriod,
    ipAddress: service.ipAddress,
    createdAt: service.createdAt.toISOString(),
    nextDueDate: service.nextDueDate ? service.nextDueDate.toISOString() : null,
    expiresAt: service.expiresAt ? service.expiresAt.toISOString() : null,
    // Resources
    diskUsed: service.diskUsed != null ? Number(service.diskUsed) : null,
    diskLimit: service.diskLimit != null ? Number(service.diskLimit) : null,
    bandwidthUsed: service.bandwidthUsed != null ? Number(service.bandwidthUsed) : null,
    bandwidthLimit: service.bandwidthLimit != null ? Number(service.bandwidthLimit) : null,
    cpuUsage: service.cpuUsage != null ? Number(service.cpuUsage) : null,
    ramUsage: service.ramUsage != null ? Number(service.ramUsage) : null,
    product: {
      id: service.product.id,
      name: service.product.name,
      features: service.product.features as string[],
      resourceLimits: service.product.resourceLimits as Record<string, string>,
      category: service.product.category
        ? {
            slug: service.product.category.slug,
            name: service.product.category.name,
          }
        : null,
    },
    backups: service.backups.map((b) => ({
      id: b.id,
      type: b.type,
      status: b.status,
      size: b.size != null ? Number(b.size) : null,
      completedAt: b.completedAt ? b.completedAt.toISOString() : null,
      createdAt: b.createdAt.toISOString(),
    })),
    pendingCancellation: pendingCancellation
      ? {
          id: pendingCancellation.id,
          reason: pendingCancellation.reason,
          createdAt: pendingCancellation.createdAt.toISOString(),
        }
      : null,
  };

  return <HizmetDetayContent service={serialized} />;
}
