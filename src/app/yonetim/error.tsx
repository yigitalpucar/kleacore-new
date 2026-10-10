"use client";

import { AppRouteError } from "@/components/app/route-states";

export default function AdminError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <AppRouteError error={error} reset={reset} home={{ href: "/yonetim", label: "Genel bakışa dön" }} />;
}
