import { EklentilerContent } from "./content";
import { getOrderAddons } from "@/lib/dal/order-views";
import { requireAdmin } from "@/lib/utils/auth-helpers";

export const dynamic = "force-dynamic";

export default async function AddonsPage() {
  await requireAdmin();

  const addons = await getOrderAddons();
  return <EklentilerContent addons={addons} />;
}
