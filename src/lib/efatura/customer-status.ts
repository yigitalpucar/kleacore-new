import type { EInvoiceStatus } from "@prisma/client";

const statusLabels: Record<EInvoiceStatus, string> = {
  DRAFT: "E-belge hazırlanıyor",
  QUEUED: "E-belge kuyruğunda",
  SENT: "Gönderildi",
  ACCEPTED: "Kabul edildi",
  REJECTED: "Reddedildi",
  FAILED: "Gönderilemedi",
  CANCELLED: "İptal edildi",
};

export function getCustomerEInvoiceLabel(
  status: EInvoiceStatus,
  type: "e-fatura" | "e-arsiv"
) {
  const typeLabel = type === "e-fatura" ? "E-Fatura" : "E-Arşiv";
  const statusLabel = statusLabels[status] ?? status;

  if (status === "SENT" || status === "ACCEPTED") {
    return `${typeLabel} gönderildi`;
  }

  return `${typeLabel}: ${statusLabel}`;
}

export function isEInvoiceVisibleToCustomer(status: EInvoiceStatus) {
  return status !== "DRAFT" || false;
}

export function getCustomerEInvoiceBadgeClass(status: EInvoiceStatus) {
  if (status === "SENT" || status === "ACCEPTED") {
    return "bg-emerald-500/10 text-emerald-600 border-emerald-500/20";
  }
  if (status === "FAILED" || status === "REJECTED" || status === "CANCELLED") {
    return "bg-red-500/10 text-red-600 border-red-500/20";
  }
  return "bg-blue-500/10 text-blue-600 border-blue-500/20";
}