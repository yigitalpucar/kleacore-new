import { NextResponse, type NextRequest } from "next/server";
import { formFiles, formText } from "@/lib/support/http";
import { handleTicketUpload } from "@/lib/support/route";
import { addStaffReply } from "@/lib/support/web";
import { checkApiPermission } from "@/lib/utils/auth-helpers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Staff: reply (multipart: message, status = ADMIN_REPLY | WAITING | CLOSED, files[]). */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const access = await checkApiPermission("tickets.reply");
  if (!access.ok) {
    return NextResponse.json(
      { success: false, error: access.status === 401 ? "Oturum gerekli" : "Yetkisiz erişim" },
      { status: access.status, headers: { "cache-control": "no-store" } }
    );
  }
  const { id } = await params;
  return handleTicketUpload(request, async (actor, form) =>
    addStaffReply(actor, id, formText(form, "message"), formText(form, "status"), await formFiles(form))
  );
}
