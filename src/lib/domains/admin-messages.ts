/** Turkish messages for staff-triggered domain operations (admin panel + admin API). */

const RENEW_ERRORS: Record<string, string> = {
  DOMAIN_NOT_FOUND: "Alan adı bulunamadı",
  REGISTRAR_NOT_CONFIGURED: "Registrar etkin değil veya API bilgileri eksik",
  RENEWAL_BUSY: "Bu yenileme şu anda işleniyor; birkaç dakika sonra tekrar deneyin",
  ALREADY_COMPLETED: "Bu yenileme zaten tamamlanmış",
};

export function renewErrorMessage(error: string) {
  if (error.startsWith("OPEN_INVOICE:")) {
    return `Bu dönem için ödenmemiş yenileme faturası var (${error.slice("OPEN_INVOICE:".length)}). Önce ödemeyi alın veya faturayı iptal edin.`;
  }
  return RENEW_ERRORS[error] ?? `Registrar yenilemesi başarısız: ${error}`;
}
