"use server";

import { sendNotification } from "@/lib/notifications/send";
import { buildVerifyUrl, confirmDataRequest, createPublicDataRequest, VERIFICATION_TTL_MS } from "@/lib/privacy/requests";
import { checkRateLimit, normalizeRateLimitKey } from "@/lib/rate-limit";
import { getRequestMeta } from "@/lib/request-meta";
import { readTurnstileToken, TURNSTILE_ERROR_MESSAGE, verifyTurnstileToken } from "@/lib/security/turnstile";
import { publicDataRequestSchema } from "@/lib/validations/privacy";

const HOUR_MS = 60 * 60 * 1000;

/**
 * Public KVKK form (no account needed). The request only counts once the
 * e-mail link is confirmed; Turnstile + per-IP/per-address limits keep the
 * form from being used to mail third parties.
 */
export async function submitPublicDataRequestAction(formData: FormData) {
  const parsed = publicDataRequestSchema.safeParse({
    type: formData.get("type"),
    name: formData.get("name"),
    email: formData.get("email"),
    phone: formData.get("phone") ?? undefined,
    details: formData.get("details"),
    confirm: formData.get("confirm"),
  });
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0]?.message ?? "Geçersiz bilgiler" };
  }

  const meta = await getRequestMeta();
  const captcha = await verifyTurnstileToken(readTurnstileToken(formData), {
    remoteIp: meta.ip,
    action: "kvkk-request",
  });
  if (!captcha.success) return { success: false, error: TURNSTILE_ERROR_MESSAGE };

  const limits = await Promise.all([
    checkRateLimit({ key: `kvkk-form:email:${normalizeRateLimitKey(parsed.data.email)}`, limit: 3, windowMs: HOUR_MS }),
    meta.ip
      ? checkRateLimit({ key: `kvkk-form:ip:${normalizeRateLimitKey(meta.ip)}`, limit: 5, windowMs: HOUR_MS })
      : Promise.resolve({ allowed: true }),
  ]);
  if (limits.some((limit) => !limit.allowed)) {
    return { success: false, error: "Çok fazla başvuru yapıldı. Lütfen bir süre sonra tekrar deneyin." };
  }

  try {
    const { request, token } = await createPublicDataRequest({
      type: parsed.data.type,
      name: parsed.data.name,
      email: parsed.data.email,
      phone: parsed.data.phone,
      details: parsed.data.details,
      ipAddress: meta.ip,
      userAgent: meta.userAgent,
    });

    const verifyUrl = buildVerifyUrl(token);
    await sendNotification({
      template: "privacy.request-verify",
      to: request.email,
      channel: "EMAIL",
      data: {
        recipientName: request.name,
        requestNumber: request.requestNumber,
        type: request.type,
        verifyUrl,
        expiresInHours: Math.round(VERIFICATION_TTL_MS / HOUR_MS),
      },
      dedupeKey: `privacy.verify:${request.id}`,
    });

    return {
      success: true,
      requestNumber: request.requestNumber,
      ...(process.env.NODE_ENV !== "production" ? { debugVerifyUrl: verifyUrl } : {}),
    };
  } catch (error) {
    console.error("[KVKK] public request failed:", error);
    return { success: false, error: "Başvurunuz kaydedilemedi. Lütfen daha sonra tekrar deneyin." };
  }
}

/** Confirm button on the verification page (POST, so mail scanners can't confirm). */
export async function confirmDataRequestAction(formData: FormData) {
  const token = String(formData.get("token") ?? "");
  const meta = await getRequestMeta();
  if (meta.ip) {
    const limit = await checkRateLimit({
      key: `kvkk-confirm:ip:${normalizeRateLimitKey(meta.ip)}`,
      limit: 20,
      windowMs: HOUR_MS,
    });
    if (!limit.allowed) return { ok: false as const, reason: "invalid" as const };
  }
  const result = await confirmDataRequest(token);
  return result.ok ? { ...result, dueAt: result.dueAt.toISOString() } : result;
}
