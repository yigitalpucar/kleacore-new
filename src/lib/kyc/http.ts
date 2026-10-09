import { NextResponse, type NextRequest } from "next/server";
import type { KycDocumentType } from "@prisma/client";
import { auth } from "@/lib/auth";
import { getRequestMeta } from "@/lib/request-meta";
import { checkRateLimit } from "@/lib/rate-limit";
import { BodyTooLargeError, isSameOriginRequest, readMultipartForm } from "@/lib/support/http";
import { KYC_MAX_REQUEST_BYTES, type KycFileInput } from "./documents";
import { KycError, submitKycDocuments } from "./service";

const NO_STORE = { "cache-control": "no-store" };

/** Multipart field name → document type. */
export const KYC_FORM_FIELDS: Record<string, KycDocumentType> = {
  identityFront: "IDENTITY_FRONT",
  identityBack: "IDENTITY_BACK",
  taxCertificate: "TAX_CERTIFICATE",
  selfie: "SELFIE",
};

function json(body: unknown, status: number) {
  return NextResponse.json(body, { status, headers: NO_STORE });
}

export async function kycFilesFromForm(form: FormData): Promise<KycFileInput[]> {
  const files: KycFileInput[] = [];
  for (const [field, type] of Object.entries(KYC_FORM_FIELDS)) {
    const entries = form.getAll(field);
    for (const entry of entries) {
      if (typeof entry === "string" || entry.size === 0) continue;
      files.push({ type, name: entry.name, data: Buffer.from(await entry.arrayBuffer()) });
    }
  }
  return files;
}

/** POST /api/kyc/documents — the signed-in customer's KYC submission. */
export async function handleKycUpload(request: NextRequest) {
  if (!isSameOriginRequest(request)) return json({ success: false, error: "Geçersiz istek kaynağı" }, 403);

  const session = await auth();
  if (!session?.user?.id) return json({ success: false, error: "Oturum gerekli" }, 401);

  const limit = await checkRateLimit({ key: `kyc-upload:${session.user.id}`, limit: 10, windowMs: 60 * 60 * 1000 });
  if (!limit.allowed) return json({ success: false, error: "Çok fazla deneme; lütfen daha sonra tekrar deneyin." }, 429);

  let form: FormData;
  try {
    form = await readMultipartForm(request, KYC_MAX_REQUEST_BYTES);
  } catch (error) {
    if (error instanceof BodyTooLargeError) {
      return json({ success: false, error: "Dosyalar çok büyük (dosya başına en fazla 8 MB)." }, 413);
    }
    return json({ success: false, error: "Form okunamadı" }, 400);
  }

  const meta = await getRequestMeta();
  try {
    const result = await submitKycDocuments({
      userId: session.user.id,
      files: await kycFilesFromForm(form),
      consentAccepted: form.get("consent") === "on" || form.get("consent") === "true",
      ipAddress: meta.ip,
      userAgent: meta.userAgent,
    });
    return json({ success: true, data: result }, 200);
  } catch (error) {
    if (error instanceof KycError) return json({ success: false, error: error.message }, 400);
    console.error("[KYC] Belge yüklenemedi:", error);
    return json({ success: false, error: "Belgeler kaydedilemedi; lütfen tekrar deneyin." }, 500);
  }
}
