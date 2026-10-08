import { NextRequest, NextResponse } from "next/server";
import { getPaymentGatewayConfig } from "@/lib/integrations/payment-gateways";
import { buildPaytrCallbackHash } from "@/lib/integrations/payment-gateways/paytr-hash";
import { fulfillGatewayReference } from "@/lib/payments/gateway-fulfillment";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function readFormValue(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

/** PayTR posts amounts in kuruş as integer strings ("3456" = 34,56 TL). */
function parseKurus(value: string) {
  if (!value) return undefined;
  if (!/^\d+$/.test(value)) return Number.NaN;
  return Number(value) / 100;
}

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const merchantOid = readFormValue(formData, "merchant_oid");
  const status = readFormValue(formData, "status");
  const totalAmount = readFormValue(formData, "total_amount");
  const receivedHash = readFormValue(formData, "hash");

  if (!merchantOid || !status || !totalAmount || !receivedHash) {
    return new NextResponse("PAYTR notification failed: missing fields", { status: 400 });
  }

  const config = await getPaymentGatewayConfig();
  const { merchantKey, merchantSalt } = config.paytr;

  if (!merchantKey || !merchantSalt) {
    return new NextResponse("PAYTR notification failed: not configured", { status: 400 });
  }

  const expectedHash = buildPaytrCallbackHash(
    merchantOid,
    merchantSalt,
    status,
    totalAmount,
    merchantKey
  );

  if (expectedHash !== receivedHash) {
    return new NextResponse("PAYTR notification failed: bad hash", { status: 400 });
  }

  if (status === "success") {
    // PayTR always expects "OK"; a mismatch is logged and left unpaid for
    // admin review instead of making PayTR retry the notification.
    await fulfillGatewayReference(merchantOid, "PayTR iframe ödemesi", {
      paidAmount: parseKurus(totalAmount),
      requestedAmount: parseKurus(readFormValue(formData, "payment_amount")),
      currency: readFormValue(formData, "currency") || undefined,
    });
  }

  return new NextResponse("OK");
}