import type { Metadata } from "next";
import { getServers } from "@/lib/dal/servers";
import { SunucularContent } from "./content";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Sunucular" };

export default async function SunucularPage() {
  const servers = await getServers();

  return <SunucularContent servers={servers} />;
}
