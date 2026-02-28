import { IptalTalepleriContent } from "./content";
import { getCancellationRequests } from "@/lib/dal/order-views";
import { requireAdmin } from "@/lib/utils/auth-helpers";

export default async function CancellationRequestsPage() {
  await requireAdmin();

  const requests = await getCancellationRequests();
  return <IptalTalepleriContent requests={requests} />;
}
