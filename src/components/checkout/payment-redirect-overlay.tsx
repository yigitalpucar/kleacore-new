"use client";

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { Loader2, Lock } from "lucide-react";

export type PaymentRedirectPhase = "creating" | "redirecting" | "bank";

const COPY: Record<PaymentRedirectPhase, { title: string; description: string }> = {
  creating: {
    title: "Siparişiniz oluşturuluyor…",
    description: "Faturalarınız hazırlanıyor. Lütfen bu sayfayı kapatmayın ve geri tuşuna basmayın.",
  },
  redirecting: {
    title: "Güvenli ödeme sayfasına yönlendiriliyorsunuz…",
    description: "Ödeme sayfası açılıyor. Lütfen bu sayfayı kapatmayın ve geri tuşuna basmayın.",
  },
  bank: {
    title: "Bankaya yönlendiriliyorsunuz…",
    description:
      "Bankanızın 3D Secure doğrulama sayfası açılıyor. Lütfen bu sayfayı kapatmayın, yenilemeyin ve geri tuşuna basmayın.",
  },
};

/**
 * Full-screen, non-dismissable progress state shown from the moment a
 * checkout is submitted until the browser leaves for the payment page. It
 * covers the whole page, so nothing can be clicked (no double submits) while
 * the order is created or the gateway page loads.
 */
export function PaymentRedirectOverlay({
  phase,
  gatewayName,
}: {
  phase: PaymentRedirectPhase | null;
  /** "Kuveyt Türk", "PayTR", "iyzico"… shown as the destination. */
  gatewayName?: string | null;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!phase) return;
    dialogRef.current?.focus();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    // Keep keyboard focus inside the overlay (there is nothing to interact with).
    const keepFocus = (event: KeyboardEvent) => {
      if (event.key === "Tab") {
        event.preventDefault();
        dialogRef.current?.focus();
      }
    };
    document.addEventListener("keydown", keepFocus);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", keepFocus);
    };
  }, [phase]);

  if (!phase || typeof document === "undefined") return null;
  const copy = COPY[phase];

  return createPortal(
    <div
      ref={dialogRef}
      role="alertdialog"
      aria-modal="true"
      aria-busy="true"
      aria-labelledby="payment-redirect-title"
      aria-describedby="payment-redirect-description"
      tabIndex={-1}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-background/95 px-6 outline-none backdrop-blur-sm motion-safe:animate-in motion-safe:fade-in-0"
    >
      <div className="w-full max-w-sm text-center">
        <span className="mx-auto flex size-14 items-center justify-center rounded-2xl border bg-background shadow-sm">
          <Loader2 aria-hidden className="size-6 motion-safe:animate-spin" />
        </span>
        <h2 id="payment-redirect-title" className="mt-6 text-balance text-xl font-semibold tracking-tight" aria-live="assertive">
          {copy.title}
        </h2>
        <p id="payment-redirect-description" className="mt-2 text-pretty text-sm text-muted-foreground">
          {copy.description}
        </p>
        {gatewayName ? (
          <p className="mt-6 inline-flex items-center gap-1.5 rounded-full border px-3 py-1 font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
            <Lock aria-hidden className="size-3" />
            {gatewayName}
          </p>
        ) : null}
      </div>
    </div>,
    document.body
  );
}

/**
 * Resets redirect state when the page comes back from the back/forward cache
 * (customer pressed "geri" on the bank page): otherwise the overlay would
 * still cover the restored page.
 */
export function useResetOnPageShow(reset: () => void) {
  const resetRef = useRef(reset);
  useEffect(() => {
    resetRef.current = reset;
  });
  useEffect(() => {
    const onPageShow = (event: PageTransitionEvent) => {
      if (event.persisted) resetRef.current();
    };
    window.addEventListener("pageshow", onPageShow);
    return () => window.removeEventListener("pageshow", onPageShow);
  }, []);
}
