import type { Metadata } from "next";
import { EklentilerContent } from "./content";
import { getOrderAddons } from "@/lib/dal/order-views";
import { requirePermission } from "@/lib/utils/auth-helpers";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Sipariş eklentileri" };

export default async function AddonsPage() {
  await requirePermission("orders.view");

  const addons = await getOrderAddons();
  return <EklentilerContent addons={addons} />;
}
