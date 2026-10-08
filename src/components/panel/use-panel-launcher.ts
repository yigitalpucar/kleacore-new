"use client";

import { useState } from "react";
import { toast } from "@/lib/toast";

type LaunchResult = { success: true; url: string } | { success: false; error: string };

/**
 * Opens a one-time panel login URL (cPanel / Webmail SSO) in a new tab.
 * The tab is opened synchronously on click (so popup blockers allow it) and
 * pointed at the URL once the server action returns; if the browser blocked
 * it, the current tab navigates instead. The URL is used immediately and
 * never kept in state.
 */
export function usePanelLauncher() {
  const [pending, setPending] = useState<string | null>(null);

  async function launch(key: string, action: () => Promise<LaunchResult>) {
    if (pending) return;
    setPending(key);
    const tab = typeof window !== "undefined" ? window.open("about:blank", "_blank") : null;
    try {
      const result = await action();
      if (!result.success) {
        tab?.close();
        toast.error(result.error);
        return;
      }
      if (tab) {
        tab.opener = null;
        tab.location.replace(result.url);
      } else {
        window.location.assign(result.url);
      }
    } catch {
      tab?.close();
      toast.error("Panel bağlantısı açılamadı. Lütfen tekrar deneyin.");
    } finally {
      setPending(null);
    }
  }

  return { launch, pending };
}
