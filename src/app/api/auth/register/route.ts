import { NextRequest, NextResponse } from "next/server";
import { hash } from "bcryptjs";
import {
  AFFILIATE_REF_COOKIE,
  createCustomerUser,
} from "@/lib/affiliate";
import { db } from "@/lib/db";
import { checkRateLimit, normalizeRateLimitKey } from "@/lib/rate-limit";
import { passwordSchema } from "@/lib/validations/auth";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { name, surname, email, password } = body;

  if (!name || !surname || !email || !password) {
    return NextResponse.json(
      { error: "Tüm alanları doldurun" },
      { status: 400 }
    );
  }

  const passwordResult = passwordSchema.safeParse(password);
  if (!passwordResult.success) {
    return NextResponse.json(
      {
        error:
          passwordResult.error.errors[0]?.message ??
          "Şifre güvenlik gereksinimlerini karşılamıyor",
      },
      { status: 400 }
    );
  }

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

  const existing = await db.user.findUnique({ where: { email } });
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