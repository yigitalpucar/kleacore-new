import type { Metadata } from "next";
import { getServerById } from "@/lib/dal/servers";
import { notFound } from "next/navigation";
import { ServerDetailContent } from "./content";
import { requirePermission } from "@/lib/utils/auth-helpers";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Sunucu detayı" };

export default async function ServerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePermission("provisioning.manage");
  const { id } = await params;
  const server = await getServerById(id);

  if (!server) return notFound();

  return <ServerDetailContent server={server} />;
}
