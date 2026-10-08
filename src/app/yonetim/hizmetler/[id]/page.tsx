import type { Metadata } from "next";
import { getServiceById } from "@/lib/dal/services";
import { notFound } from "next/navigation";
import { ServiceDetailContent } from "./content";
import { serializeMoney } from "@/lib/money";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Hizmet detayı" };

export default async function ServiceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const service = await getServiceById(id);

  if (!service) return notFound();

  return <ServiceDetailContent service={serializeMoney(service)} />;
}
