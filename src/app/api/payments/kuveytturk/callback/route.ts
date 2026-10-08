import { NextRequest, NextResponse } from "next/server";
import { handleKuveytTurkCallback } from "@/lib/integrations/payment-gateways/providers/kuveytturk-flow";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * OkUrl and FailUrl. The bank's 3-D page posts `AuthenticationResponse`
 * (URL-encoded XML) here from the customer's browser; the outcome is decided
 * by ResponseCode + HashData, then the customer is sent on with a 303.
 */
export async function POST(request: NextRequest) {
  let raw = "";
  try {
    const formData = await request.formData();
    const value = formData.get("AuthenticationResponse");
    raw = typeof value === "string" ? value : "";
  } catch {
    raw = "";
  }

  const result = await handleKuveytTurkCallback(raw);

  return NextResponse.redirect(new URL(result.redirectPath, request.url), {
    status: 303,
    headers: { "cache-control": "no-store, max-age=0" },
  });
}
