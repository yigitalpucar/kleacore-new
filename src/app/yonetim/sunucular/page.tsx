import type { Metadata } from "next";
import { getServers } from "@/lib/dal/servers";
import { SunucularContent } from "./content";
import { requirePermission } from "@/lib/utils/auth-helpers";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Sunucular" };

export default async function SunucularPage() {
  await requirePermission("provisioning.manage");
  const servers = await getServers();

  return <SunucularContent servers={servers} />;
}
