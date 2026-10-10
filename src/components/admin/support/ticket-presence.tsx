"use client";

import * as React from "react";
import { Eye, PenLine } from "lucide-react";
import { leaveTicketPresence, pingTicketPresence } from "@/lib/actions/admin/ticket-presence";
import { PRESENCE_HEARTBEAT_MS, describeViewers, type PresenceViewer } from "@/lib/support/presence";
import { ToneDot } from "@/components/app";
import { cn } from "@/lib/utils";

/** Min gap between "typing" beats sent outside the regular heartbeat. */
const TYPING_BEAT_MS = 5_000;

/**
 * Heartbeat for the ticket page: pings every ~15 s while the tab is
 * visible (and right away when the staff member starts typing), and
 * returns the other staff on this ticket.
 */
export function useTicketPresence(ticketId: string, typingSignal: number): PresenceViewer[] {
  const [viewers, setViewers] = React.useState<PresenceViewer[]>([]);
  const lastTypingBeat = React.useRef(0);
  const typingRef = React.useRef(false);

  const beat = React.useCallback(
    async (typing: boolean) => {
      try {
        const result = await pingTicketPresence(ticketId, typing);
        setViewers(result.viewers);
      } catch {
        // Presence is a hint only; a failed beat is retried on the next tick.
      }
    },
    [ticketId]
  );

  // Regular heartbeat (paused while the tab is hidden).
  React.useEffect(() => {
    let timer: ReturnType<typeof setInterval> | null = null;
    const start = () => {
      if (timer) return;
      void beat(typingRef.current);
      timer = setInterval(() => {
        void beat(typingRef.current);
        typingRef.current = false;
      }, PRESENCE_HEARTBEAT_MS);
    };
    const stop = () => {
      if (timer) clearInterval(timer);
      timer = null;
    };
    const onVisibility = () => (document.visibilityState === "visible" ? start() : stop());
    if (document.visibilityState === "visible") start();
    document.addEventListener("visibilitychange", onVisibility);
    const leave = () => void leaveTicketPresence(ticketId).catch(() => undefined);
    window.addEventListener("pagehide", leave);
    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", leave);
      leave();
    };
  }, [beat, ticketId]);

  // Typing: mark for the next beat, and send one now if none went out recently.
  React.useEffect(() => {
    if (!typingSignal) return;
    typingRef.current = true;
    const now = Date.now();
    if (now - lastTypingBeat.current >= TYPING_BEAT_MS) {
      lastTypingBeat.current = now;
      void beat(true);
    }
  }, [typingSignal, beat]);

  return viewers;
}

/** Collision warning above the reply box. */
export function TicketPresenceNotice({ viewers, className }: { viewers: PresenceViewer[]; className?: string }) {
  const text = describeViewers(viewers);
  const typing = viewers.some((v) => v.typing);
  return (
    // display: contents → no empty gap in the page's vertical rhythm while nobody else is here.
    <div role="status" aria-live="polite" className={cn("contents", className)}>
      {text ? (
        <p
          className={cn(
            "mt-6 flex items-start gap-2.5 rounded-lg border px-4 py-3 text-sm",
            typing ? "border-foreground/25 bg-muted/60" : "border-dashed bg-muted/30"
          )}
        >
          {typing ? (
            <span className="relative mt-0.5 shrink-0">
              <PenLine aria-hidden className="size-4" />
              <ToneDot tone="warning" className="absolute -right-1 -top-1" />
            </span>
          ) : (
            <Eye aria-hidden className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
          )}
          <span>
            <span className="font-medium">{text}.</span>{" "}
            <span className="text-muted-foreground">
              {typing ? "Çift yanıt gitmemesi için göndermeden önce ekip arkadaşınızla konuşun." : "Yanıt yazmadan önce talebin son durumunu kontrol edin."}
            </span>
          </span>
        </p>
      ) : null}
    </div>
  );
}
