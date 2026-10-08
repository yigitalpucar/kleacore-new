import type { LucideIcon } from "lucide-react";
import { FileBadge, Globe, Headphones, KeyRound, Network, Shield } from "lucide-react";
import { TrustBar, defaultTrustItems } from "@/components/site/trust-bar";

export interface TrustStripItem {
  icon: LucideIcon;
  label: string;
  desc: string;
}

/** Factual domain facts (no extension counts or unverifiable promises). */
export const domainTrustItems: TrustStripItem[] = [
  { icon: Globe, label: "Popüler uzantılar", desc: ".com, .net, .com.tr ve diğerleri" },
  { icon: Network, label: "DNS yönetimi", desc: "Müşteri panelinden" },
  { icon: KeyRound, label: "Kolay transfer", desc: "EPP/transfer kodu ile" },
  { icon: Headphones, label: "7/24 Destek", desc: "Destek talebi ve e-posta" },
];

export const sslTrustItems: TrustStripItem[] = [
  { icon: Shield, label: "TLS şifreleme", desc: "HTTPS ile güvenli bağlantı" },
  { icon: FileBadge, label: "DV, OV, EV", desc: "Doğrulama seçenekleri" },
  { icon: Globe, label: "Wildcard seçeneği", desc: "Alt alan adları için" },
  { icon: Headphones, label: "7/24 Destek", desc: "Kurulum yardımı" },
];

interface TrustStripProps {
  items?: TrustStripItem[];
}

/** Legacy wrapper around the kit's `TrustBar`. */
export function TrustStrip({ items }: TrustStripProps) {
  return (
    <TrustBar
      items={
        items
          ? items.map((item) => ({ icon: item.icon, label: item.label, description: item.desc }))
          : defaultTrustItems
      }
    />
  );
}
