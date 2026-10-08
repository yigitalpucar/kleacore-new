import type { Metadata } from "next";
import { IptalTalepleriContent } from "./content";
import { getCancellationRequests } from "@/lib/dal/order-views";
import { requireAdmin } from "@/lib/utils/auth-helpers";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "İptal talepleri" };

export default async function CancellationRequestsPage() {
  await requireAdmin();

  const requests = await getCancellationRequests();
  return <IptalTalepleriContent requests={requests} />;
}
