"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

/**
 * Re-renders the server page every `intervalMs` while `active`, at most
 * `maxAttempts` times — used on the payment result page while the gateway
 * callback has not marked the invoices paid yet.
 */
export function AutoRefresh({
  active,
  intervalMs = 4000,
  maxAttempts = 8,
}: {
  active: boolean;
  intervalMs?: number;
  maxAttempts?: number;
}) {
  const router = useRouter();
  const attempts = useRef(0);

  useEffect(() => {
    if (!active) return;
    const timer = window.setInterval(() => {
      if (attempts.current >= maxAttempts) {
        window.clearInterval(timer);
        return;
      }
      attempts.current += 1;
      router.refresh();
    }, intervalMs);
    return () => window.clearInterval(timer);
  }, [active, intervalMs, maxAttempts, router]);

  return null;
}
