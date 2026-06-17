import { getServiceById } from "@/lib/dal/services";
import { notFound } from "next/navigation";
import { ServiceDetailContent } from "./content";

export const dynamic = "force-dynamic";

export default async function ServiceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const service = await getServiceById(id);

  if (!service) return notFound();

  return <ServiceDetailContent service={service} />;
}
