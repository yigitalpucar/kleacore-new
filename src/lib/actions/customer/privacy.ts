"use server";

import { revalidatePath } from "next/cache";
import { createPanelDataRequest } from "@/lib/privacy/requests";
import { checkRateLimit } from "@/lib/rate-limit";
import { getRequestMeta } from "@/lib/request-meta";
import { requireCustomer } from "@/lib/utils/auth-helpers";
import { panelDataRequestSchema } from "@/lib/validations/privacy";

/** Signed-in customer: identity is the session, so the request is received immediately. */
export async function submitCustomerDataRequestAction(formData: FormData) {
  const session = await requireCustomer();
  const parsed = panelDataRequestSchema.safeParse({ type: formData.get("type"), details: formData.get("details") });
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0]?.message ?? "Geçersiz bilgiler" };
  }

  const limit = await checkRateLimit({ key: `kvkk-panel:${session.user.id}`, limit: 5, windowMs: 24 * 60 * 60 * 1000 });
  if (!limit.allowed) {
    return { success: false, error: "Bugün için başvuru sınırına ulaştınız. Lütfen yarın tekrar deneyin." };
  }

  try {
    const meta = await getRequestMeta();
    const request = await createPanelDataRequest(session.user.id, {
      type: parsed.data.type,
      details: parsed.data.details,
      ipAddress: meta.ip,
      userAgent: meta.userAgent,
    });
    revalidatePath("/musteri/panel/kvkk");
    return { success: true, requestNumber: request.requestNumber };
  } catch (error) {
    console.error("[KVKK] panel request failed:", error);
    return { success: false, error: "Başvurunuz kaydedilemedi. Lütfen daha sonra tekrar deneyin." };
  }
}
