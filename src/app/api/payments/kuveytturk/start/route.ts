import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getClientIp } from "@/lib/auth/credentials";
import { checkRateLimit } from "@/lib/rate-limit";
import { getAppBaseUrl } from "@/lib/stripe";
import { validateCard } from "@/lib/payments/card-validation";
import { beginKuveytTurkPayment } from "@/lib/integrations/payment-gateways/providers/kuveytturk-flow";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE = { "cache-control": "no-store, max-age=0" };

function readField(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function backToForm(request: NextRequest, ref: string, error: string) {
  const url = new URL("/odeme/kuveytturk", request.url);
  if (ref) url.searchParams.set("ref", ref);
  url.searchParams.set("hata", error);
  return NextResponse.redirect(url, { status: 303, headers: NO_STORE });
}

/** Same-origin form posts only (the card form is ours). */
function isSameOrigin(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  const allowed = new Set([new URL(getAppBaseUrl()).origin, request.nextUrl.origin]);
  return allowed.has(origin);
}

function isInsecureProductionRequest(request: NextRequest) {
  if (process.env.NODE_ENV !== "production") return false;
  const proto = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim() ?? request.nextUrl.protocol.replace(":", "");
  return proto !== "https";
}

/**
 * Card form → Kuveyt Türk ThreeDModelPayGate. Card data is read from the
 * form, validated and forwarded in memory; it is never stored, logged or
 * echoed. The response is the bank's self-submitting 3-D Secure HTML.
 */
export async function POST(request: NextRequest) {
  if (isInsecureProductionRequest(request)) {
    return new NextResponse("HTTPS gerekli", { status: 400, headers: NO_STORE });
  }
  if (!isSameOrigin(request)) {
    return new NextResponse("Geçersiz istek", { status: 403, headers: NO_STORE });
  }

  const formData = await request.formData();
  const ref = readField(formData, "ref").trim();

  const session = await auth();
  const customerId = session?.user?.id;
  if (!customerId) {
    const callbackUrl = `/odeme/kuveytturk?ref=${encodeURIComponent(ref)}`;
    return NextResponse.redirect(
      new URL(`/musteri/giris?callbackUrl=${encodeURIComponent(callbackUrl)}`, request.url),
      { status: 303, headers: NO_STORE }
    );
  }

  const limit = await checkRateLimit({
    key: `kuveytturk-start:${customerId}`,
    limit: 10,
    windowMs: 15 * 60 * 1000,
  });
  if (!limit.allowed) return backToForm(request, ref, "cok-deneme");

  const validation = validateCard({
    holderName: readField(formData, "cardHolderName"),
    number: readField(formData, "cardNumber"),
    expiry: readField(formData, "cardExpiry"),
    cvv: readField(formData, "cardCvv"),
  });
  if (!validation.ok) return backToForm(request, ref, "kart");

  const result = await beginKuveytTurkPayment({
    merchantOrderId: ref,
    customerId,
    card: validation.card,
    clientIp: getClientIp(request) ?? "127.0.0.1",
  });

  if (!result.ok) {
    const error =
      result.reason === "not_found"
        ? "bulunamadi"
        : result.reason === "not_payable"
          ? "odenemez"
          : result.reason === "not_configured"
            ? "kapali"
            : "banka";
    return backToForm(request, ref, error);
  }

  return new NextResponse(result.html, {
    status: 200,
    headers: { ...NO_STORE, "content-type": "text/html; charset=utf-8" },
  });
}
