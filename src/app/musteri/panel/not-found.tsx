import type { Metadata } from "next";
import { AppRouteNotFound } from "@/components/app/route-states";

export const metadata: Metadata = { title: "Sayfa bulunamadı" };

export default function PanelNotFound() {
  return <AppRouteNotFound home={{ href: "/musteri/panel", label: "Genel bakışa dön" }} />;
}
