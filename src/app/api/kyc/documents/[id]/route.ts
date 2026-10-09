import type { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { isStaffRole } from "@/lib/auth/permissions";
import { loadKycDocumentForViewer } from "@/lib/kyc/service";
import { staffTwoFactorMissing } from "@/lib/utils/auth-helpers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MESSAGES = { 401: "Oturum gerekli", 404: "Belge bulunamadı", 410: "Belge silinmiş" } as const;

/** KYC document (its owner or staff with kyc.review only). */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  // Staff without the required 2FA only see their own documents (like any customer).
  const role =
    session?.user && isStaffRole(session.user.role) && (await staffTwoFactorMissing(session.user.id))
      ? null
      : session?.user?.role;
  const result = await loadKycDocumentForViewer(session?.user ? { id: session.user.id, role } : null, id);
  if (!result.ok) {
    return new Response(MESSAGES[result.status], {
      status: result.status,
      headers: { "content-type": "text/plain; charset=utf-8", "x-content-type-options": "nosniff", "cache-control": "no-store" },
    });
  }
  return new Response(new Uint8Array(result.body), { status: 200, headers: result.headers });
}
