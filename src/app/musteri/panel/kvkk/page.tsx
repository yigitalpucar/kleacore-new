import type { Metadata } from "next";
import { auth } from "@/lib/auth";
import { getCustomerDataRequests } from "@/lib/dal/privacy";
import { KvkkContent } from "./content";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Kişisel verilerim" };

export default async function KvkkPage({ searchParams }: { searchParams: Promise<{ tur?: string }> }) {
  const session = await auth();
  const [{ tur }, requests] = await Promise.all([searchParams, getCustomerDataRequests(session!.user.id)]);
  return (
    <KvkkContent
      initialType={tur === "silme" ? "ERASURE" : tur === "kopya" ? "EXPORT" : ""}
      requests={requests.map((r) => ({
        id: r.id,
        requestNumber: r.requestNumber,
        type: r.type,
        status: r.status,
        createdAt: r.createdAt.toISOString(),
        dueAt: r.dueAt?.toISOString() ?? null,
        completedAt: r.completedAt?.toISOString() ?? null,
        responseText: r.responseText,
      }))}
    />
  );
}
