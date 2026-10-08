import type { Metadata } from "next";
import { db } from "@/lib/db";
import { CannedRepliesContent } from "./content";
import { requirePermission } from "@/lib/utils/auth-helpers";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Hazır yanıtlar" };

export default async function CannedRepliesPage() {
  await requirePermission("tickets.reply");
  const replies = await db.cannedReply.findMany({
    orderBy: [{ usageCount: "desc" }, { title: "asc" }],
    select: { id: true, title: true, body: true, department: true, usageCount: true, updatedAt: true },
  });
  return (
    <CannedRepliesContent
      replies={replies.map((r) => ({ ...r, department: r.department ?? null, updatedAt: r.updatedAt.toISOString() }))}
    />
  );
}
