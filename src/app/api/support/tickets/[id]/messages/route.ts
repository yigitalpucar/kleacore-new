import type { NextRequest } from "next/server";
import { formFiles, formText } from "@/lib/support/http";
import { handleTicketUpload } from "@/lib/support/route";
import { addCustomerReply } from "@/lib/support/web";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Customer: reply to own ticket (multipart: message, files[]). */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return handleTicketUpload(request, async (actor, form) =>
    addCustomerReply(actor, id, formText(form, "message"), await formFiles(form))
  );
}
