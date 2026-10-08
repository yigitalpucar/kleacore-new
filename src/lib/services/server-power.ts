/**
 * Customer power controls share the SUSPENDED status with billing suspensions
 * (the ServiceStatus enum has no STOPPED value). `suspendReason` tells them
 * apart: only a server the customer stopped themselves may be started again
 * from the customer panel. Anything suspended for non-payment, by an admin or
 * expired has to go through payment / admin unsuspend instead.
 */
export const CUSTOMER_STOPPED_REASON = "CUSTOMER_STOPPED";

type PowerState = { status: string; suspendReason?: string | null };

export function isCustomerStopped(service: PowerState): boolean {
  return service.status === "SUSPENDED" && service.suspendReason === CUSTOMER_STOPPED_REASON;
}

/** Turkish reason the customer can't start this server, or null if they can. */
export function customerStartBlockReason(service: PowerState): string | null {
  if (service.status === "ACTIVE") return "Sunucu zaten çalışıyor";
  if (isCustomerStopped(service)) return null;
  if (service.status === "CANCELLED") return "İptal edilmiş sunucu başlatılamaz";
  if (service.status === "EXPIRED") return "Süresi dolmuş sunucu, yenileme sonrası açılır";
  return "Askıdaki sunucu, ödeme veya destek sonrası açılır";
}
