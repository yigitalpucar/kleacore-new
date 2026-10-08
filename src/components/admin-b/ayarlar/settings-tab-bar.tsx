"use client";

import { Bell, Building2, CreditCard, Key, Mail, Shield, Users } from "lucide-react";
import { SettingsTabBar } from "@/components/admin-b/integrations/shared";

const items = [
  { value: "general", label: "Genel", icon: Building2 },
  { value: "email", label: "E-posta", icon: Mail },
  { value: "notifications", label: "Bildirimler", icon: Bell },
  { value: "payment", label: "Ödeme", icon: CreditCard },
  { value: "security", label: "Güvenlik", icon: Shield },
  { value: "users", label: "Kullanıcılar", icon: Users },
  { value: "api", label: "API", icon: Key },
];

/** Tab row for /yonetim/ayarlar (icons live client-side). */
export function AyarlarTabBar() {
  return <SettingsTabBar items={items} label="Ayar bölümleri" />;
}
