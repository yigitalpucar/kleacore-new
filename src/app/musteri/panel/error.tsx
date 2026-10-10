"use client";

import { AppRouteError } from "@/components/app/route-states";

export default function PanelError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <AppRouteError
      error={error}
      reset={reset}
      home={{ href: "/musteri/panel", label: "Genel bakışa dön" }}
      support={{ href: "/musteri/panel/destek/yeni", label: "Destek talebi aç" }}
    />
  );
}
