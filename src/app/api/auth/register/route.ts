import { NextRequest, NextResponse } from "next/server";
import { hash } from "bcryptjs";
import {
  AFFILIATE_REF_COOKIE,
  createCustomerUser,
} from "@/lib/affiliate";
import { findUserByEmail } from "@/lib/auth/email";
import { db } from "@/lib/db";
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

  const existing = await findUserByEmail(email);
  if (existing) {
    return NextResponse.json(
      { error: "Bu e-posta adresi zaten kayıtlı" },
      { status: 400 }
    );
  }

  const hashedPassword = await hash(password, 12);
  const refCode = req.cookies.get(AFFILIATE_REF_COOKIE)?.value;

  await db.$transaction(async (tx) => {
    await createCustomerUser(
      tx,
      {
        name,
        surname,
        email,
        password: hashedPassword,
      },
      refCode
    );
  });

  const response = NextResponse.json({ success: true });
  response.cookies.delete(AFFILIATE_REF_COOKIE);

  return response;
}