import type { Metadata } from "next";
import { YukseltmeDusurmeContent } from "./content";
import { getUpgradeDowngradeOperations } from "@/lib/dal/order-views";
import { requireAdmin } from "@/lib/utils/auth-helpers";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Yükseltme ve düşürme" };

export default async function UpgradeDowngradePage() {
  await requireAdmin();

  const operations = await getUpgradeDowngradeOperations();
  return <YukseltmeDusurmeContent operations={operations} />;
}
