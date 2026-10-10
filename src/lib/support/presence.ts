/**
 * Ticket collision warning (UI3 item 13): staff pages send a heartbeat
 * every ~15 s; these windows decide who counts as "viewing" or "typing".
 */
export const PRESENCE_HEARTBEAT_MS = 15_000;
/** Seen within this window → still on the page (a missed beat is tolerated). */
export const PRESENCE_VIEWING_MS = 40_000;
/** Typed within this window → "yanıt yazıyor". */
export const PRESENCE_TYPING_MS = 20_000;
/** Rows older than this are deleted by the next heartbeat. */
export const PRESENCE_STALE_MS = 120_000;

export interface PresenceRow {
  userId: string;
  name: string;
  lastSeenAt: Date;
  typingAt: Date | null;
}

export interface PresenceViewer {
  userId: string;
  name: string;
  typing: boolean;
}

/** Other staff currently on the ticket, typing ones first. */
export function activeViewers(rows: PresenceRow[], selfId: string, now: Date): PresenceViewer[] {
  const t = now.getTime();
  return rows
    .filter((r) => r.userId !== selfId && t - r.lastSeenAt.getTime() <= PRESENCE_VIEWING_MS)
    .map((r) => ({ userId: r.userId, name: r.name, typing: !!r.typingAt && t - r.typingAt.getTime() <= PRESENCE_TYPING_MS }))
    .sort((a, b) => Number(b.typing) - Number(a.typing) || a.name.localeCompare(b.name, "tr"));
}

/** "Ayşe Y. bu talebe yanıt yazıyor" / "Ayşe Y. ve Can D. bu talebi görüntülüyor". */
export function describeViewers(viewers: PresenceViewer[]): string | null {
  if (!viewers.length) return null;
  const typing = viewers.filter((v) => v.typing);
  const list = (vs: PresenceViewer[]) =>
    vs.length === 1 ? vs[0].name : `${vs.slice(0, -1).map((v) => v.name).join(", ")} ve ${vs[vs.length - 1].name}`;
  if (typing.length) {
    const others = viewers.length - typing.length;
    return `${list(typing)} bu talebe yanıt yazıyor${others ? ` (${others} kişi daha görüntülüyor)` : ""}`;
  }
  return `${list(viewers)} bu talebi görüntülüyor`;
}

/** "Ayşe Yılmaz" → "Ayşe Y." */
export function shortName(name: string, surname: string) {
  const first = name.trim();
  const initial = surname.trim().charAt(0);
  return initial ? `${first} ${initial.toLocaleUpperCase("tr-TR")}.` : first || "Bir personel";
}
