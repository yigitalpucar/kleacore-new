import type { NextRequest } from "next/server";
import { formFiles, formText } from "@/lib/support/http";
import { handleTicketUpload } from "@/lib/support/route";
import { createCustomerTicket } from "@/lib/support/web";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Customer: new ticket (multipart: subject, department, priority, message, relatedServiceId, files[]). */
export async function POST(request: NextRequest) {
  return handleTicketUpload(request, async (actor, form) =>
    createCustomerTicket(
      actor,
      {
        subject: formText(form, "subject"),
        department: formText(form, "department"),
        priority: formText(form, "priority"),
        message: formText(form, "message"),
        relatedServiceId: formText(form, "relatedServiceId"),
      },
      await formFiles(form)
    )
  );
}
