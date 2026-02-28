import { NextResponse } from "next/server";

export function success<T>(data: T, status = 200) {
  return NextResponse.json({ success: true, data }, { status });
}

export function error(message: string, status = 400) {
  return NextResponse.json({ success: false, error: message }, { status });
}

export function unauthorized(message = "Yetkisiz erişim") {
  return error(message, 401);
}

export function forbidden(message = "Erişim reddedildi") {
  return error(message, 403);
}

export function notFound(message = "Kayıt bulunamadı") {
  return error(message, 404);
}

export function validationError(errors: Record<string, string[]>) {
  return NextResponse.json(
    { success: false, error: "Doğrulama hatası", errors },
    { status: 422 }
  );
}
