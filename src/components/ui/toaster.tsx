"use client";

import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Info, X, XCircle } from "lucide-react";
import { APP_TOAST_EVENT, type ToastPayload, type ToastVariant } from "@/lib/toast";
import { cn } from "@/lib/utils";

interface ToastItem extends ToastPayload {
  id: string;
  variant: ToastVariant;
  duration: number;
}

const variantClasses: Record<ToastVariant, string> = {
  success: "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900/40 dark:bg-emerald-950/60 dark:text-emerald-100",
  error: "border-red-200 bg-red-50 text-red-900 dark:border-red-900/40 dark:bg-red-950/60 dark:text-red-100",
  info: "border-blue-200 bg-blue-50 text-blue-900 dark:border-blue-900/40 dark:bg-blue-950/60 dark:text-blue-100",
};

function ToastIcon({ variant }: { variant: ToastVariant }) {
  if (variant === "success") return <CheckCircle2 className="h-4 w-4 shrink-0" />;
  if (variant === "error") return <XCircle className="h-4 w-4 shrink-0" />;
  return <Info className="h-4 w-4 shrink-0" />;
}

export function Toaster() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  };

  useEffect(() => {
    const onToast = (event: Event) => {
      const customEvent = event as CustomEvent<ToastPayload>;
      const payload = customEvent.detail;
      if (!payload?.message) return;

      const item: ToastItem = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        title: payload.title,
        message: payload.message,
        variant: payload.variant ?? "info",
        duration: payload.duration ?? 3500,
      };

      setToasts((prev) => [item, ...prev].slice(0, 4));

      window.setTimeout(() => {
        removeToast(item.id);
      }, item.duration);
    };

    window.addEventListener(APP_TOAST_EVENT, onToast as EventListener);
    return () => window.removeEventListener(APP_TOAST_EVENT, onToast as EventListener);
  }, []);

  const hasToasts = useMemo(() => toasts.length > 0, [toasts.length]);

  if (!hasToasts) return null;

  return (
    <div className="pointer-events-none fixed right-4 top-4 z-[200] flex w-full max-w-sm flex-col gap-2">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={cn(
            "pointer-events-auto rounded-lg border p-3 shadow-lg backdrop-blur-sm transition-all",
            variantClasses[toast.variant]
          )}
          role="status"
          aria-live="polite"
        >
          <div className="flex items-start gap-2">
            <ToastIcon variant={toast.variant} />
            <div className="min-w-0 flex-1">
              {toast.title ? <p className="text-sm font-semibold">{toast.title}</p> : null}
              <p className="text-sm leading-5">{toast.message}</p>
            </div>
            <button
              type="button"
              onClick={() => removeToast(toast.id)}
              className="rounded p-0.5 opacity-70 transition hover:opacity-100"
              aria-label="Bildirimi kapat"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

