import { NextRequest, NextResponse } from "next/server";
import { getPaymentGatewayConfig } from "@/lib/integrations/payment-gateways";
import { retrieveIyzicoCheckoutResult } from "@/lib/integrations/payment-gateways/providers/iyzico";
import { fulfillGatewayReference } from "@/lib/payments/gateway-fulfillment";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** iyzico reports amounts as decimal numbers/strings in TRY ("120.5"). */
function parseGatewayAmount(value: number | string | undefined) {
  if (value === undefined || value === null || value === "") return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

function readToken(request: NextRequest, formData: FormData) {
  const queryToken = request.nextUrl.searchParams.get("token");
  if (queryToken) return queryToken;

  const bodyToken = formData.get("token");
  return typeof bodyToken === "string" ? bodyToken : null;
}

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const token = readToken(request, formData);

  if (!token) {
    return NextResponse.json({ error: "iyzico token eksik" }, { status: 400 });
  }

  const config = await getPaymentGatewayConfig();
  if (!config.iyzico.apiKey || !config.iyzico.secretKey) {
    return NextResponse.json({ error: "iyzico yapılandırılmamış" }, { status: 400 });
  }

  const result = await retrieveIyzicoCheckoutResult(config.iyzico, token);

  if (result.status !== "success" || result.paymentStatus !== "SUCCESS") {
    return NextResponse.redirect(new URL("/musteri/panel/faturalar?payment=cancelled", request.url));
  }

  const fulfillment = await fulfillGatewayReference(token, "iyzico Checkout ödemesi", {
    paidAmount: parseGatewayAmount(result.paidPrice),
    requestedAmount: parseGatewayAmount(result.price),
    currency: result.currency,
  });

  if (fulfillment.amountMismatch) {
    return NextResponse.redirect(new URL("/musteri/panel/faturalar?payment=review", request.url));
  }

  return NextResponse.redirect(new URL("/musteri/panel/faturalar?payment=success", request.url));
}