import { NextRequest, NextResponse } from "next/server";
import { hash } from "bcryptjs";
import { db } from "@/lib/db";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { name, surname, email, password } = body;

  if (!name || !surname || !email || !password) {
    return NextResponse.json(
      { error: "Tüm alanları doldurun" },
      { status: 400 }
    );
  }

  if (password.length < 6) {
    return NextResponse.json(
      { error: "Şifre en az 6 karakter olmalı" },
      { status: 400 }
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

  await db.user.create({
    data: {
      name,
      surname,
      email,
      password: hashedPassword,
      role: "CUSTOMER",
      status: "ACTIVE",
    },
  });

  return NextResponse.json({ success: true });
}
