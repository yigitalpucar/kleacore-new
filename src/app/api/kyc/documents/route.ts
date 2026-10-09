import type { NextRequest } from "next/server";
import { handleKycUpload } from "@/lib/kyc/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Customer: KYC submission (multipart: identityFront, identityBack, taxCertificate, selfie, consent). */
export async function POST(request: NextRequest) {
  return handleKycUpload(request);
}
