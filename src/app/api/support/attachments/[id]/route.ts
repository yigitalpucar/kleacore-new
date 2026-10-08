import type { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { loadAttachmentForViewer } from "@/lib/support/download";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MESSAGES = { 401: "Oturum gerekli", 404: "Dosya bulunamadı", 410: "Dosya mevcut değil" } as const;

/** Ticket attachment download (ticket owner or support staff only). */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  const result = await loadAttachmentForViewer(
    session?.user ? { id: session.user.id, role: session.user.role } : null,
    id
  );
  if (!result.ok) {
    return new Response(MESSAGES[result.status], {
      status: result.status,
      headers: { "content-type": "text/plain; charset=utf-8", "x-content-type-options": "nosniff", "cache-control": "no-store" },
    });
  }
  return new Response(new Uint8Array(result.body), { status: 200, headers: result.headers });
}
