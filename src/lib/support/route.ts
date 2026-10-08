import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { MAX_UPLOAD_REQUEST_BYTES } from "./attachments";
import { BodyTooLargeError, isSameOriginRequest, readMultipartForm } from "./http";
import type { WebActor, WebResult } from "./web";

const NO_STORE = { "cache-control": "no-store" };

function json(body: unknown, status: number) {
  return NextResponse.json(body, { status, headers: NO_STORE });
}

/**
 * Shared body of the multipart ticket POST routes: same-origin check,
 * session, per-user rate limit, size-capped multipart parsing.
 */
export async function handleTicketUpload<T>(
  request: NextRequest,
  run: (actor: WebActor, form: FormData) => Promise<WebResult<T>>
) {
  if (!isSameOriginRequest(request)) return json({ success: false, error: "Geçersiz istek kaynağı" }, 403);

  const session = await auth();
  if (!session?.user?.id) return json({ success: false, error: "Oturum gerekli" }, 401);

  const limit = await checkRateLimit({ key: `ticket-upload:${session.user.id}`, limit: 30, windowMs: 10 * 60 * 1000 });
  if (!limit.allowed) return json({ success: false, error: "Çok fazla istek; lütfen biraz sonra tekrar deneyin." }, 429);

  let form: FormData;
  try {
    form = await readMultipartForm(request, MAX_UPLOAD_REQUEST_BYTES);
  } catch (error) {
    if (error instanceof BodyTooLargeError) {
      return json({ success: false, error: "Dosyalar toplamda çok büyük (dosya başına en fazla 10 MB, en fazla 5 dosya)." }, 413);
    }
    return json({ success: false, error: "Form okunamadı" }, 400);
  }

  const result = await run({ id: session.user.id, role: session.user.role }, form);
  if (!result.success) return json({ success: false, error: result.error }, result.status);
  return json({ success: true, data: result.data ?? null }, result.status ?? 200);
}
