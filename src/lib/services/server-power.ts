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

// ---------------------------------------------------------------------------
// Customer power buttons (panel UI): which actions, how to confirm, when done
// ---------------------------------------------------------------------------

export type CustomerPowerAction = "start" | "stop" | "restart";

export type LivePowerState = "running" | "stopped" | "paused" | "unknown";

type PowerButtonsState = PowerState & { busy?: boolean; reinstallRunning?: boolean; ready?: boolean };

export interface PowerButton {
  action: CustomerPowerAction;
  /** Turkish reason the button is disabled, or null when it can be pressed. */
  disabledReason: string | null;
}

/**
 * Buttons for a server: running → restart + stop, otherwise start (blocked
 * with customerStartBlockReason for billing/admin suspensions). Everything is
 * disabled while an action or a reinstall runs.
 */
export function customerPowerButtons(state: PowerButtonsState): PowerButton[] {
  const common =
    state.ready === false
      ? "Sunucu henüz hazır değil"
      : state.reinstallRunning
        ? "Yeniden kurulum sürüyor"
        : state.busy
          ? "İşlem sürüyor"
          : null;
  if (state.status === "ACTIVE") {
    return [
      { action: "restart", disabledReason: common },
      { action: "stop", disabledReason: common },
    ];
  }
  return [{ action: "start", disabledReason: common ?? customerStartBlockReason(state) }];
}

export const POWER_ACTION_COPY: Record<
  CustomerPowerAction,
  { label: string; running: string; done: string; confirmTitle: string; confirm: (name: string) => string; confirmLabel: string }
> = {
  start: {
    label: "Başlat",
    running: "Başlatılıyor",
    done: "Sunucu başlatıldı",
    confirmTitle: "Sunucuyu başlat",
    confirm: (name) => `“${name}” başlatılacak. Açılış genellikle bir dakikadan kısa sürer.`,
    confirmLabel: "Başlat",
  },
  restart: {
    label: "Yeniden başlat",
    running: "Yeniden başlatılıyor",
    done: "Sunucu yeniden başlatıldı",
    confirmTitle: "Sunucuyu yeniden başlat",
    confirm: (name) => `“${name}” yeniden başlatılacak. Açık bağlantılar ve çalışan işlemler kısa süreliğine kesilir.`,
    confirmLabel: "Yeniden başlat",
  },
  stop: {
    label: "Durdur",
    running: "Durduruluyor",
    done: "Sunucu durduruldu",
    confirmTitle: "Sunucuyu durdur",
    confirm: (name) =>
      `“${name}” kapatılacak (önce düzgün kapatma denenir, 60 sn sonra zorla kapatılır). Üzerindeki siteler ve uygulamalar erişilemez olur.`,
    confirmLabel: "Durdur",
  },
};

/** Power state an action should end in. */
export function expectedPowerState(action: CustomerPowerAction): LivePowerState {
  return action === "stop" ? "stopped" : "running";
}

/**
 * Has the action visibly finished? Unknown power states (legacy servers, no
 * reading yet) count as finished once the action itself returned.
 */
export function isPowerActionSettled(action: CustomerPowerAction, live: { powerState: LivePowerState }): boolean {
  return live.powerState === "unknown" || live.powerState === expectedPowerState(action);
}

export const POWER_STATE_LABELS: Record<LivePowerState, string> = {
  running: "Çalışıyor",
  stopped: "Kapalı",
  paused: "Duraklatıldı",
  unknown: "Bilinmiyor",
};
