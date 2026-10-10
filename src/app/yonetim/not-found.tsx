import type { Metadata } from "next";
import { AppRouteNotFound } from "@/components/app/route-states";

export const metadata: Metadata = { title: "Sayfa bulunamadı" };

export default function AdminNotFound() {
  return (
    <AppRouteNotFound
      home={{ href: "/yonetim", label: "Genel bakışa dön" }}
      description="Aradığınız kayıt silinmiş veya taşınmış olabilir. Arama için ⌘K / Ctrl+K kullanabilirsiniz."
    />
  );
}
