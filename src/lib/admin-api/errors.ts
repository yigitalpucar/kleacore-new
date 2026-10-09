/**
 * Admin API error format (every non-2xx answer):
 *   { "error": { "code": "insufficient_scope", "message": "…", "details"?: … }, "requestId": "…" }
 * `code` is stable and machine-readable; `message` is Turkish, for humans.
 */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: unknown,
    readonly headers?: Record<string, string>
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export const ERROR_CODES = {
  unauthenticated: "Authorization: Bearer <token> başlığı eksik",
  invalid_token: "Token geçersiz",
  token_revoked: "Token iptal edilmiş",
  token_expired: "Token süresi dolmuş",
  owner_inactive: "Token sahibinin personel hesabı aktif değil",
  owner_not_allowed: "Token sahibinin rolü Admin API kullanımına izin vermiyor",
  owner_two_factor_required: "Token sahibinin iki adımlı doğrulamayı açması gerekiyor",
  ip_not_allowed: "Bu IP adresinden erişime izin verilmiyor",
  insufficient_scope: "Token bu işlem için gereken yetkiye sahip değil",
  rate_limited: "Çok fazla istek",
  bad_request: "Geçersiz istek",
  invalid_json: "Gövde geçerli JSON değil",
  validation_failed: "Doğrulama hatası",
  invalid_cursor: "Geçersiz sayfalama imleci",
  idempotency_key_invalid: "Geçersiz Idempotency-Key",
  idempotency_key_in_use: "Bu Idempotency-Key ile bir istek hâlâ işleniyor",
  idempotency_key_reused: "Bu Idempotency-Key farklı bir istekle kullanılmış",
  not_found: "Kayıt bulunamadı",
  conflict: "İşlem kaydın mevcut durumuyla çelişiyor",
  upstream_failed: "Dış sistem işlemi başarısız",
  internal_error: "Beklenmeyen bir hata oluştu",
} as const;

export type ErrorCode = keyof typeof ERROR_CODES;

/** Maps a business-function failure ({ error, status }) to an ApiError. */
export function failure(result: { error: string; status?: number; code?: string }): ApiError {
  const status = result.status ?? 400;
  const code =
    status === 404 ? "not_found" : status === 409 ? "conflict" : status === 422 ? "validation_failed" : status >= 500 ? "upstream_failed" : "bad_request";
  return new ApiError(status, code, result.error, result.code ? { reason: result.code } : undefined);
}
