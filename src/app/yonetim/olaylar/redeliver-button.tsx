"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { RotateCw } from "lucide-react";
import { appButton } from "@/components/app";
import { redeliverEventAction } from "@/lib/actions/admin/events";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";

/**
 * "Yeniden dağıt": without `subscriber` re-runs failed/pending deliveries of
 * the event; with one, forces that subscriber again (confirmation first).
 */
export function RedeliverButton({
  eventId,
  subscriber,
  label = "Yeniden dağıt",
  confirmText,
  variant = "outline",
}: {
  eventId: string;
  subscriber?: string;
  label?: string;
  confirmText?: string;
  variant?: "outline" | "ghost" | "primary";
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      className={appButton({ variant, size: "sm" })}
      onClick={() => {
        if (confirmText && !window.confirm(confirmText)) return;
        startTransition(async () => {
          const result = await redeliverEventAction(eventId, subscriber);
          if (!result.success) {
            toast.error(result.error);
            return;
          }
          toast.success(result.queued ? "Olay yeniden kuyruğa alındı" : "Olay yeniden dağıtıldı");
          router.refresh();
        });
      }}
    >
      <RotateCw aria-hidden className={cn(pending && "animate-spin")} />
      {label}
    </button>
  );
}
