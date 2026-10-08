/** Pure SLA helpers for manual provisioning (safe to import from client components). */

export type SlaState = "ok" | "warning" | "breached";

/** Waiting time vs. the SLA target: warning from half the target, breached after it. */
export function slaState(waitingMs: number, slaHours: number): SlaState {
  const targetMs = slaHours * 60 * 60 * 1000;
  if (waitingMs >= targetMs) return "breached";
  if (waitingMs >= targetMs / 2) return "warning";
  return "ok";
}

/** "45 dk", "3 sa 12 dk", "2 gün 4 sa". */
export function formatWaiting(ms: number) {
  const minutes = Math.max(0, Math.floor(ms / 60_000));
  if (minutes < 60) return `${minutes} dk`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} sa ${minutes % 60} dk`;
  return `${Math.floor(hours / 24)} gün ${hours % 24} sa`;
}

export const SLA_LABELS: Record<SlaState, { label: string; tone: "success" | "warning" | "danger" }> = {
  ok: { label: "Süre içinde", tone: "success" },
  warning: { label: "Süre yaklaşıyor", tone: "warning" },
  breached: { label: "Süre aşıldı", tone: "danger" },
};
