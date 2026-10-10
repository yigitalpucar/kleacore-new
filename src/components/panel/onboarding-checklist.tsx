"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRight, Check, Loader2, X } from "lucide-react";
import { appButton } from "@/components/app";
import { dismissOnboarding } from "@/lib/actions/customer/onboarding";
import { resendVerificationEmailAction } from "@/lib/actions/auth";
import type { CustomerOnboarding } from "@/lib/onboarding/customer";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";

/**
 * "Hesabınızı hazırlayın" card on the panel home: real account steps with a
 * progress bar; each open step links to the page that completes it. "Kapat"
 * hides it for good (users.onboardingDismissedAt).
 */
export function OnboardingChecklist({ onboarding }: { onboarding: CustomerOnboarding }) {
  const [hidden, setHidden] = React.useState(false);
  const [dismissing, startDismiss] = React.useTransition();
  const [sending, startSend] = React.useTransition();
  const [sent, setSent] = React.useState(false);
  const headingId = React.useId();

  if (hidden) return null;

  const { steps, completed, total } = onboarding;
  const percent = Math.round((completed / total) * 100);
  const nextId = steps.find((s) => !s.done)?.id;

  const dismiss = () =>
    startDismiss(async () => {
      const result = await dismissOnboarding().catch(() => null);
      if (!result?.success) {
        toast.error("Liste gizlenemedi, lütfen tekrar deneyin.");
        return;
      }
      setHidden(true);
      toast.success("Kontrol listesi gizlendi. Bu adımlara Hesap ayarları’ndan ulaşabilirsiniz.");
    });

  const resend = () =>
    startSend(async () => {
      const result = await resendVerificationEmailAction();
      if (!result.success) {
        toast.error(result.error ?? "Doğrulama e-postası gönderilemedi.");
        return;
      }
      if ("alreadyVerified" in result && result.alreadyVerified) {
        window.location.reload();
        return;
      }
      setSent(true);
      toast.success("Doğrulama e-postası gönderildi.");
    });

  return (
    <section aria-labelledby={headingId} className="rounded-lg border bg-card shadow-sm">
      <div className="flex items-start gap-3 border-b px-4 py-4 md:px-5">
        <div className="min-w-0 flex-1 space-y-2.5">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Başlangıç</p>
            <h2 id={headingId} className="text-base font-semibold tracking-tight">
              Hesabınızı hazırlayın
            </h2>
          </div>
          <div className="flex items-center gap-3">
            <div
              role="progressbar"
              aria-label="Tamamlanan adımlar"
              aria-valuemin={0}
              aria-valuemax={total}
              aria-valuenow={completed}
              aria-valuetext={`${total} adımdan ${completed} tanesi tamamlandı`}
              className="h-1.5 w-full max-w-xs overflow-hidden rounded-full bg-muted"
            >
              <div
                className="h-full rounded-full bg-foreground transition-[width] duration-500 motion-reduce:transition-none"
                style={{ width: `${percent}%` }}
              />
            </div>
            <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
              {completed}/{total} tamamlandı
            </span>
          </div>
        </div>
        <button
          type="button"
          aria-label="Kontrol listesini kapat"
          title="Kapat"
          className={appButton({ variant: "ghost", size: "icon-sm", className: "-mr-1 -mt-1 shrink-0" })}
          disabled={dismissing}
          onClick={dismiss}
        >
          {dismissing ? <Loader2 aria-hidden className="animate-spin" /> : <X aria-hidden />}
        </button>
      </div>

      <ol className="divide-y">
        {steps.map((step, index) => {
          const isNext = step.id === nextId;
          return (
            <li key={step.id} className={cn("flex flex-col gap-3 px-4 py-3.5 sm:flex-row sm:items-center md:px-5", isNext && "bg-muted/30")}>
              <div className="flex min-w-0 flex-1 items-start gap-3">
                <span
                  aria-hidden
                  className={cn(
                    "mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full border font-mono text-[11px]",
                    step.done ? "border-foreground bg-foreground text-background" : "border-dashed text-muted-foreground"
                  )}
                >
                  {step.done ? <Check className="size-3.5" /> : index + 1}
                </span>
                <div className="min-w-0">
                  <p className={cn("text-sm font-medium", step.done && "text-muted-foreground line-through decoration-muted-foreground/40")}>
                    {step.title}
                    <span className="sr-only">{step.done ? " (tamamlandı)" : " (yapılacak)"}</span>
                  </p>
                  {step.done ? null : <p className="mt-0.5 text-xs text-muted-foreground">{step.description}</p>}
                </div>
              </div>
              {step.done ? null : step.href ? (
                <Link
                  href={step.href}
                  className={appButton({ variant: isNext ? "primary" : "outline", size: "sm", className: "w-full shrink-0 sm:w-auto" })}
                >
                  {step.cta}
                  <ArrowRight aria-hidden />
                </Link>
              ) : (
                <button
                  type="button"
                  className={appButton({ variant: isNext ? "primary" : "outline", size: "sm", className: "w-full shrink-0 sm:w-auto" })}
                  disabled={sending || sent}
                  onClick={resend}
                >
                  {sending ? <Loader2 aria-hidden className="animate-spin" /> : null}
                  {sent ? "Gönderildi, gelen kutunuzu kontrol edin" : step.cta}
                </button>
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
