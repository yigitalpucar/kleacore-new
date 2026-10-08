import { NextRequest, NextResponse } from "next/server";
import { AFFILIATE_REF_COOKIE } from "@/lib/affiliate";
import { getClientIp } from "@/lib/auth/credentials";
import { registerCustomerAccount } from "@/lib/auth/registration";
import { checkRateLimit, normalizeRateLimitKey } from "@/lib/rate-limit";
import { registerApiSchema } from "@/lib/validations/auth";

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Geçersiz istek gövdesi" }, { status: 400 });
  }

  const parsed = registerApiSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.errors[0]?.message ?? "Tüm alanları doldurun" },
      { status: 400 }
    );
  }

  const { name, surname, email, password } = parsed.data;

  const limit = await checkRateLimit({
    key: `api-register:${normalizeRateLimitKey(email)}`,
    limit: 4,
    windowMs: 60 * 60 * 1000,
  });
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Çok fazla kayıt denemesi yapıldı" },
      { status: 429 }
    );
  }

  // Same rules as the register form: Turnstile, KVKK acknowledgement and
  // e-mail verification (this endpoint must not be a way around them).
  const result = await registerCustomerAccount({
    name,
    surname,
    email,
    password,
    kvkkAccepted: parsed.data.kvkkAccepted === true,
    turnstileToken: parsed.data.turnstileToken ?? null,
    refCode: req.cookies.get(AFFILIATE_REF_COOKIE)?.value,
    ipAddress: getClientIp(req),
    userAgent: req.headers.get("user-agent")?.slice(0, 512) ?? null,
  });

  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: result.status === 409 ? 400 : result.status });
  }

  const response = NextResponse.json({ success: true });
  response.cookies.delete(AFFILIATE_REF_COOKIE);

  return response;
}
