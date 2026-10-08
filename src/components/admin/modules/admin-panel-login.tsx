"use client";

import { Loader2, LogIn, Mail } from "lucide-react";
import { appButton } from "@/components/app";
import { usePanelLauncher } from "@/components/panel/use-panel-launcher";
import { openServicePanelAsAdmin } from "@/lib/actions/admin/hosting-panel";

/**
 * Admin service detail → "cPanel'e giriş (müşteri olarak)" / Webmail.
 * Opens a fresh one-time login in a new tab; each login is written to the
 * activity log by the server action.
 */
export function AdminPanelLoginButtons({ serviceId }: { serviceId: string }) {
  const { launch, pending } = usePanelLauncher();
  return (
    <>
      <button
        type="button"
        disabled={pending !== null}
        onClick={() => void launch("panel", () => openServicePanelAsAdmin(serviceId, "panel"))}
        className={appButton({ variant: "outline", size: "sm" })}
      >
        {pending === "panel" ? <Loader2 aria-hidden className="animate-spin" /> : <LogIn aria-hidden />}
        cPanel&apos;e giriş (müşteri olarak)
      </button>
      <button
        type="button"
        disabled={pending !== null}
        onClick={() => void launch("webmail", () => openServicePanelAsAdmin(serviceId, "webmail"))}
        className={appButton({ variant: "ghost", size: "sm" })}
      >
        {pending === "webmail" ? <Loader2 aria-hidden className="animate-spin" /> : <Mail aria-hidden />}
        Webmail
      </button>
    </>
  );
}
