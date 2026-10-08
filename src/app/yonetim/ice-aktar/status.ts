import type { StatusTone } from "@/components/app";

export const RUN_STATUS_META: Record<string, { label: string; tone: StatusTone }> = {
  QUEUED: { label: "Sırada", tone: "muted" },
  FETCHING: { label: "Listeleniyor", tone: "info" },
  READY: { label: "Önizleme hazır", tone: "warning" },
  IMPORTING: { label: "İçe aktarılıyor", tone: "info" },
  COMPLETED: { label: "Tamamlandı", tone: "success" },
  FAILED: { label: "Başarısız", tone: "danger" },
};

export const ROW_STATUS_META: Record<string, { label: string; tone: StatusTone }> = {
  PENDING: { label: "Bekliyor", tone: "muted" },
  IMPORTED: { label: "İçe aktarıldı", tone: "success" },
  LINKED: { label: "Bağlandı", tone: "success" },
  SKIPPED: { label: "Atlandı", tone: "neutral" },
  FAILED: { label: "Hata", tone: "danger" },
};

export const SOURCE_LABELS: Record<string, string> = {
  WHM: "cPanel/WHM",
  PROXMOX: "Proxmox",
  REGISTRAR: "Alan adları",
};

export const ACTIVE_RUN_STATUSES = ["QUEUED", "FETCHING", "IMPORTING"];
