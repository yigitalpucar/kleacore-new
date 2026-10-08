import { Clock, Gauge, Headphones, HardDrive, Lock, MapPin, PanelsTopLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { Container } from "./container";
import { GridLineHorizontal } from "./grid-lines";
import { resolveIcon, type IconRef } from "./icon";

export interface TrustBarItem {
  icon?: IconRef;
  label: string;
  description?: string;
}

/** Factual infrastructure facts only — no counts, ratings or guarantees. */
export const defaultTrustItems: TrustBarItem[] = [
  { icon: HardDrive, label: "NVMe SSD", description: "Hızlı disk altyapısı" },
  { icon: Gauge, label: "LiteSpeed", description: "Web sunucu yazılımı" },
  { icon: PanelsTopLeft, label: "cPanel", description: "Kontrol paneli" },
  { icon: Lock, label: "Ücretsiz SSL", description: "Let's Encrypt" },
  { icon: MapPin, label: "İstanbul", description: "Sunucu lokasyonu" },
  { icon: Headphones, label: "7/24 Destek", description: "Destek talebi ve e-posta" },
];

export const backupTrustItem: TrustBarItem = {
  icon: Clock,
  label: "Otomatik Yedek",
  description: "Pakete göre haftalık/günlük",
};

/**
 * Horizontal strip of short facts separated by dashed lines.
 * 2 columns on phones, up to 6 on desktop.
 */
export function TrustBar({
  items = defaultTrustItems,
  className,
  bordered = true,
}: {
  items?: TrustBarItem[];
  className?: string;
  /** Dashed lines above and below (default true). */
  bordered?: boolean;
}) {
  const cols =
    items.length >= 6
      ? "lg:grid-cols-6"
      : items.length === 5
        ? "lg:grid-cols-5"
        : items.length === 4
          ? "lg:grid-cols-4"
          : "lg:grid-cols-3";

  return (
    <div className={cn("relative", className)}>
      {bordered ? <GridLineHorizontal className="top-0" /> : null}
      <Container>
        <ul className={cn("grid grid-cols-2 sm:grid-cols-3", cols)}>
          {items.map((item) => {
            const Icon = resolveIcon(item.icon);
            return (
              <li key={item.label} className="flex items-center gap-3 px-1 py-5 sm:px-3">
                {Icon ? (
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-md border bg-background">
                    <Icon aria-hidden className="size-4 text-foreground/80" />
                  </span>
                ) : null}
                <span className="min-w-0">
                  <span className="block text-sm font-medium leading-tight">{item.label}</span>
                  {item.description ? (
                    <span className="mt-0.5 block text-xs leading-tight text-muted-foreground">
                      {item.description}
                    </span>
                  ) : null}
                </span>
              </li>
            );
          })}
        </ul>
      </Container>
      {bordered ? <GridLineHorizontal className="bottom-0" /> : null}
    </div>
  );
}
