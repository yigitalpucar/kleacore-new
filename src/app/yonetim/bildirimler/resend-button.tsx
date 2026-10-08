"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { RotateCw } from "lucide-react";
import { appButton } from "@/components/app";
import { resendNotificationAction } from "@/lib/actions/admin/notifications";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";

/** "Yeniden gönder": queues a copy of the notification (not shown while the original is still queued). */
export function ResendButton({ id, status }: { id: string; status: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [done, setDone] = useState(false);

  if (status === "QUEUED") return null;

  return (
    <button
      type="button"
      disabled={pending || done}
      className={appButton({ variant: "outline", size: "sm" })}
      onClick={() =>
        startTransition(async () => {
          const result = await resendNotificationAction(id);
          if (!result.success) {
            toast.error(result.error);
            return;
          }
          setDone(true);
          toast.success("Bildirim yeniden kuyruğa alındı");
          router.refresh();
        })
      }
    >
      <RotateCw aria-hidden className={cn(pending && "animate-spin")} />
      {done ? "Kuyruğa alındı" : "Yeniden gönder"}
    </button>
  );
}
