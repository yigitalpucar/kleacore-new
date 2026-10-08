"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { appButton } from "@/components/app";
import { cn } from "@/lib/utils";

/** Re-fetches the page's server data without a full reload. */
export function RefreshButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      className={appButton({ variant: "outline", size: "sm" })}
      onClick={() => startTransition(() => router.refresh())}
      disabled={pending}
    >
      <RefreshCw aria-hidden className={cn(pending && "animate-spin")} />
      {pending ? "Yenileniyor…" : "Yenile"}
    </button>
  );
}
