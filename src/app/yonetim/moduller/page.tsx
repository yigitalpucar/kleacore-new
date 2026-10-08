import type { Metadata } from "next";
import { getModulesOverview } from "@/lib/modules/admin-view";
import { ModullerContent } from "./content";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Modüller" };

export default async function ModullerPage() {
  const overview = await getModulesOverview();
  return <ModullerContent overview={overview} />;
}
