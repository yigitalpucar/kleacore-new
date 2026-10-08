"use client";

import { useState, useTransition } from "react";
import { Loader2, MailWarning } from "lucide-react";
import { resendVerificationEmailAction } from "@/lib/actions/auth";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";

/**
 * Shown to signed-in customers whose e-mail is not verified yet: ordering and
 * payments are blocked until they click the link we sent.
 */
export function EmailVerificationBanner({
  email,
  className,
  compact = false,
}: {
  email?: string | null;
  className?: string;
  /** Always stacked (narrow columns such as the cart summary). */
  compact?: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const [sent, setSent] = useState(false);

  const resend = () => {
    startTransition(async () => {
      const result = await resendVerificationEmailAction();
      if (!result.success) {
        toast.error(result.error ?? "Doğrulama e-postası gönderilemedi.");
        return;
      }
      if ("alreadyVerified" in result && result.alreadyVerified) {
        toast.success("E-posta adresiniz zaten doğrulanmış. Sayfa yenileniyor.");
        window.location.reload();
        return;
      }
      setSent(true);
      toast.success("Doğrulama e-postası tekrar gönderildi.");
    });
  };

  return (
    <div
      role="status"
      className={cn(
        "flex flex-col gap-3 rounded-lg border border-amber-500/40 bg-amber-500/10 p-4 text-sm",
        !compact && "sm:flex-row sm:items-center sm:justify-between",
        className
      )}
    >
      <div className="flex min-w-0 items-start gap-3">
        <MailWarning aria-hidden className="mt-0.5 size-5 shrink-0 text-amber-600 dark:text-amber-400" />
        <div className="min-w-0">
          <p className="font-medium text-foreground">E-posta adresinizi doğrulayın</p>
          <p className="mt-0.5 text-muted-foreground">
            Sipariş verebilmek ve ödeme yapabilmek için{" "}
            {email ? <span className="break-all font-medium text-foreground">{email}</span> : "e-posta"} adresine
            gönderdiğimiz bağlantıya tıklayın.
            {sent ? " Yeni bağlantı gönderildi; gelen kutunuzu ve istenmeyen klasörünü kontrol edin." : null}
          </p>
        </div>
      </div>
      <button
        type="button"
        onClick={resend}
        disabled={isPending}
        className="inline-flex min-h-10 shrink-0 whitespace-normal text-center items-center justify-center gap-2 rounded-md border bg-background px-3 text-sm font-medium transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
      >
        {isPending ? <Loader2 aria-hidden className="size-4 animate-spin" /> : null}
        Doğrulama e-postasını tekrar gönder
      </button>
    </div>
  );
}
