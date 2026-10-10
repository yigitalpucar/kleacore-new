"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, Play, Power, RotateCcw } from "lucide-react";
import { appButton } from "@/components/app";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { getServerStatus, restartServer, startServer, stopServer } from "@/lib/actions/customer/servers";
import type { ServerLiveStatus } from "@/lib/modules/server-panel";
import {
  POWER_ACTION_COPY,
  POWER_STATE_LABELS,
  customerPowerButtons,
  isPowerActionSettled,
  type CustomerPowerAction,
} from "@/lib/services/server-power";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";

export type PowerTarget = { id: string; name: string; status: string; suspendReason: string | null };

export type PowerRun = { id: string; name: string; action: CustomerPowerAction; live: ServerLiveStatus | null };

const ACTIONS: Record<CustomerPowerAction, (id: string) => Promise<{ success: boolean; error?: string }>> = {
  start: startServer,
  stop: stopServer,
  restart: restartServer,
};

const ICONS: Record<CustomerPowerAction, React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>> = {
  start: Play,
  stop: Power,
  restart: RotateCcw,
};

const POLL_MS = 2_500;
const SETTLE_TIMEOUT_MS = 90_000;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Power actions behind a confirmation dialog that names the server. While an
 * action runs the live status is polled (getServerStatus) and every button of
 * that server is disabled; it settles when the VM reaches the expected power
 * state (or after the action returned for servers without a live reading).
 */
export function useServerPower(options: { onDone?: (run: PowerRun, ok: boolean) => void } = {}) {
  const router = useRouter();
  const [pending, setPending] = React.useState<{ target: PowerTarget; action: CustomerPowerAction } | null>(null);
  const [run, setRun] = React.useState<PowerRun | null>(null);
  const mounted = React.useRef(true);
  const onDone = React.useRef(options.onDone);
  React.useEffect(() => {
    onDone.current = options.onDone;
  });
  React.useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const execute = React.useCallback(
    async (target: PowerTarget, action: CustomerPowerAction) => {
      const copy = POWER_ACTION_COPY[action];
      const current: PowerRun = { id: target.id, name: target.name, action, live: null };
      setRun(current);

      const poll = async () => {
        const result = await getServerStatus(target.id).catch(() => null);
        if (!result?.success) return null;
        if (mounted.current) setRun((r) => (r && r.id === target.id ? { ...r, live: result.live } : r));
        return result.live;
      };
      const timer = setInterval(() => void poll(), POLL_MS);
      let ok = false;
      try {
        const result = await ACTIONS[action](target.id);
        if (!result.success) {
          toast.error(result.error ?? "İşlem başarısız");
          return;
        }
        const deadline = Date.now() + SETTLE_TIMEOUT_MS;
        while (mounted.current && Date.now() < deadline) {
          const live = await poll();
          if (!live || isPowerActionSettled(action, live)) break;
          await sleep(POLL_MS);
        }
        ok = true;
        toast.success(copy.done);
      } catch {
        toast.error("İşlem başarısız");
      } finally {
        clearInterval(timer);
        if (mounted.current) {
          setRun(null);
          onDone.current?.(current, ok);
          router.refresh();
        }
      }
    },
    [router]
  );

  const confirmPending = () => {
    if (!pending) return;
    const { target, action } = pending;
    setPending(null);
    void execute(target, action);
  };

  const copy = pending ? POWER_ACTION_COPY[pending.action] : null;
  const dialog = (
    <Dialog open={Boolean(pending)} onOpenChange={(open) => (open ? null : setPending(null))}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{copy?.confirmTitle}</DialogTitle>
          <DialogDescription>{pending && copy ? copy.confirm(pending.target.name) : null}</DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2">
          <button type="button" className={appButton({ variant: "outline" })} onClick={() => setPending(null)}>
            Vazgeç
          </button>
          <button
            type="button"
            className={appButton({ variant: pending?.action === "stop" ? "destructive" : "primary" })}
            onClick={confirmPending}
          >
            {copy?.confirmLabel}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  return {
    /** Opens the confirmation dialog for `action` on `target`. */
    request: (target: PowerTarget, action: CustomerPowerAction) => setPending({ target, action }),
    run,
    isBusy: (id: string) => run?.id === id,
    dialog,
  };
}

export type ServerPowerController = ReturnType<typeof useServerPower>;

/** Power buttons of one server (detail page footer, mobile card). */
export function ServerPowerButtons({
  target,
  power,
  ready,
  reinstallRunning,
  size = "sm",
  className,
}: {
  target: PowerTarget;
  power: ServerPowerController;
  ready?: boolean;
  reinstallRunning?: boolean;
  size?: "sm" | "md";
  className?: string;
}) {
  const busy = power.isBusy(target.id);
  const buttons = customerPowerButtons({ ...target, busy: Boolean(power.run), reinstallRunning, ready });
  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      {buttons.map((b) => {
        const Icon = ICONS[b.action];
        const spinning = busy && power.run?.action === b.action;
        return (
          <button
            key={b.action}
            type="button"
            className={appButton({ variant: b.action === "stop" ? "destructive" : b.action === "start" ? "primary" : "outline", size })}
            disabled={Boolean(b.disabledReason)}
            title={b.disabledReason ?? undefined}
            onClick={() => power.request(target, b.action)}
          >
            {spinning ? <Loader2 aria-hidden className="animate-spin" /> : <Icon aria-hidden />}
            {POWER_ACTION_COPY[b.action].label}
          </button>
        );
      })}
    </div>
  );
}

/** Live line while an action runs on `id` ("Yeniden başlatılıyor… · Güncel durum: Çalışıyor"). */
export function ServerPowerProgress({ power, id, className }: { power: ServerPowerController; id?: string; className?: string }) {
  const run = power.run && (!id || power.run.id === id) ? power.run : null;
  return (
    <p role="status" aria-live="polite" className={cn(run ? "flex items-center gap-2 text-sm" : "sr-only", className)}>
      {run ? (
        <>
          <Loader2 aria-hidden className="size-4 shrink-0 animate-spin text-muted-foreground motion-reduce:animate-none" />
          <span>
            {id ? null : <span className="font-medium">{run.name}: </span>}
            {POWER_ACTION_COPY[run.action].running}…
            {run.live ? (
              <span className="text-muted-foreground"> · Güncel durum: {POWER_STATE_LABELS[run.live.powerState]}</span>
            ) : null}
          </span>
        </>
      ) : null}
    </p>
  );
}
