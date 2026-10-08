import type { Metadata } from "next";
import { getModulesOverview } from "@/lib/modules/admin-view";
import { ModullerContent } from "./content";
import { requirePermission } from "@/lib/utils/auth-helpers";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Modüller" };

export default async function ModullerPage() {
  await requirePermission("modules.manage");
  const overview = await getModulesOverview();
  return <ModullerContent overview={overview} />;
}
