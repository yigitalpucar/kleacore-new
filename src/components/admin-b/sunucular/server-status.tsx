import type { StatusTone } from "@/components/app";
import { cn } from "@/lib/utils";

/**
 * Server health is derived (no enum in the schema): inactive → maintenance,
 * not online → offline, CPU or RAM ≥ 90% → warning, else online.
 */
export type ServerStatus = "online" | "warning" | "maintenance" | "offline";

export function getServerStatus(server: {
  isActive: boolean;
  isOnline: boolean;
  cpuUsage: number;
  ramUsage: number;
}): ServerStatus {
  if (!server.isActive) return "maintenance";
  if (!server.isOnline) return "offline";
  if (server.cpuUsage >= 90 || server.ramUsage >= 90) return "warning";
  return "online";
}

export const serverStatusMeta: Record<ServerStatus, { label: string; tone: StatusTone }> = {
  online: { label: "Çevrimiçi", tone: "success" },
  warning: { label: "Uyarı", tone: "warning" },
  maintenance: { label: "Bakımda", tone: "info" },
  offline: { label: "Çevrimdışı", tone: "danger" },
};

export const serverStatusOptions = (Object.keys(serverStatusMeta) as ServerStatus[]).map((value) => ({
  value,
  label: serverStatusMeta[value].label,
}));

/** Compact usage bar for table cells (amber ≥70%, red ≥90%). */
export function ServerUsageCell({ value, hidden = false }: { value: number; hidden?: boolean }) {
  if (hidden) return <span className="text-muted-foreground">—</span>;
  const clamped = Math.max(0, Math.min(100, value));
  const fill = clamped >= 90 ? "bg-red-500" : clamped >= 70 ? "bg-amber-500" : "bg-foreground/80";
  return (
    <div className="w-20 space-y-1">
      <span className="block text-xs font-medium tabular-nums">%{clamped.toLocaleString("tr-TR", { maximumFractionDigits: 1 })}</span>
      <div aria-hidden className="h-1.5 overflow-hidden rounded-full bg-muted">
        <div className={cn("h-full rounded-full", fill)} style={{ width: `${clamped}%` }} />
      </div>
    </div>
  );
}
