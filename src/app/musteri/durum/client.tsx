"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, RefreshCw } from "lucide-react";
import { buttonClasses } from "@/components/site/button-classes";
import { subscribeNewsletter } from "@/lib/actions/contact";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";

export function RefreshButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      onClick={() => startTransition(() => router.refresh())}
      disabled={pending}
      className={buttonClasses({ variant: "outline" })}
    >
      <RefreshCw aria-hidden className={cn("size-4", pending && "animate-spin")} />
      {pending ? "Yenileniyor…" : "Yenile"}
    </button>
  );
}

export function SubscribeForm() {
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!email.trim()) {
      toast.error("Lütfen e-posta adresinizi girin.");
      return;
    }
    setSubmitting(true);
    try {
      const result = await subscribeNewsletter(email, "system-status");
      if (!result.success) {
        toast.error(result.error ?? "Abonelik tamamlanamadı.");
        return;
      }
      toast.success(result.message ?? "Aboneliğiniz kaydedildi.");
      setEmail("");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex w-full flex-col gap-3 sm:flex-row">
      <label htmlFor="status-subscribe-email" className="sr-only">
        E-posta adresi
      </label>
      <input
        id="status-subscribe-email"
        type="email"
        autoComplete="email"
        required
        placeholder="ornek@alanadiniz.com"
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        className="h-11 w-full min-w-0 flex-1 rounded-md border border-input bg-background px-3 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      />
      <button
        type="submit"
        disabled={submitting}
        className={buttonClasses({ variant: "primary", className: "shrink-0" })}
      >
        {submitting ? <Loader2 aria-hidden className="size-4 animate-spin" /> : null}
        {submitting ? "Kaydediliyor…" : "Abone ol"}
      </button>
    </form>
  );
}
