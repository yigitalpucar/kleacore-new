"use client";

import { useActionState, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { CheckCircle2, Send } from "lucide-react";
import { cn } from "@/lib/utils";
import { buttonClasses } from "@/components/site/button-classes";
import { GridPattern } from "@/components/site/kurumsal/grid-pattern";
import { submitContactForm } from "@/lib/actions/contact";
import { toast } from "@/lib/toast";

const fieldClass =
  "w-full rounded-md border bg-background px-3.5 text-sm text-foreground shadow-sm transition-shadow placeholder:text-muted-foreground/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-60";

const labelClass = "mb-2 inline-block text-sm font-medium text-foreground";

/** Contact form (Aceternity "contact form grid" panel). Submits via `submitContactForm`. */
export function IletisimForm() {
  const searchParams = useSearchParams();
  const defaultSubject = searchParams.get("konu") ?? "";
  const [isSuccess, setIsSuccess] = useState(false);
  const [state, formAction, isPending] = useActionState(
    async (_prev: { success: boolean; error?: string } | null, formData: FormData) => {
      const result = await submitContactForm(formData);
      if (result.success) {
        setIsSuccess(true);
      }
      return result;
    },
    null,
  );

  useEffect(() => {
    if (!state) return;
    if (state.success) {
      toast.success("Mesajınız başarıyla gönderildi.");
      return;
    }
    if (state.error) {
      toast.error(state.error);
    }
  }, [state]);

  const hasError = Boolean(state && !state.success && state.error);

  return (
    <div className="relative overflow-hidden rounded-2xl border bg-gradient-to-b from-muted/70 to-muted/30 p-5 shadow-sm sm:p-8 lg:p-10 dark:from-muted/40 dark:to-background">
      <GridPattern />
      {isSuccess ? (
        <div role="status" className="relative flex min-h-[30rem] flex-col items-center justify-center text-center">
          <span className="flex size-12 items-center justify-center rounded-lg border bg-background shadow-sm">
            <CheckCircle2 aria-hidden className="size-6 text-foreground" />
          </span>
          <h3 className="mt-6 text-xl font-semibold tracking-tight">Mesajınız gönderildi</h3>
          <p className="mt-2 max-w-sm text-sm text-muted-foreground">
            En kısa sürede size dönüş yapacağız. Teşekkürler!
          </p>
          <button
            type="button"
            onClick={() => setIsSuccess(false)}
            className={buttonClasses({ variant: "outline", className: "mt-6" })}
          >
            Yeni mesaj gönder
          </button>
        </div>
      ) : (
        <form action={formAction} className="relative space-y-5" aria-describedby={hasError ? "iletisim-hata" : undefined}>
          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <label htmlFor="name" className={labelClass}>
                Ad soyad
              </label>
              <input
                id="name"
                name="name"
                autoComplete="name"
                placeholder="Adınız Soyadınız"
                required
                disabled={isPending}
                className={cn(fieldClass, "h-11")}
              />
            </div>
            <div>
              <label htmlFor="email" className={labelClass}>
                E-posta
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                placeholder="ornek@email.com"
                required
                disabled={isPending}
                className={cn(fieldClass, "h-11")}
              />
            </div>
          </div>
          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <label htmlFor="phone" className={labelClass}>
                Telefon <span className="font-normal text-muted-foreground">(isteğe bağlı)</span>
              </label>
              <input
                id="phone"
                name="phone"
                type="tel"
                autoComplete="tel"
                placeholder="+90 5xx xxx xx xx"
                disabled={isPending}
                className={cn(fieldClass, "h-11")}
              />
            </div>
            <div>
              <label htmlFor="subject" className={labelClass}>
                Konu
              </label>
              <input
                id="subject"
                name="subject"
                placeholder="Mesaj konusu"
                defaultValue={defaultSubject}
                key={defaultSubject}
                required
                disabled={isPending}
                className={cn(fieldClass, "h-11")}
              />
            </div>
          </div>
          <div>
            <label htmlFor="message" className={labelClass}>
              Mesajınız
            </label>
            <textarea
              id="message"
              name="message"
              rows={7}
              placeholder="Size nasıl yardımcı olabiliriz?"
              required
              disabled={isPending}
              className={cn(fieldClass, "min-h-[10rem] py-3")}
            />
          </div>
          {hasError ? (
            <p id="iletisim-hata" role="alert" className="text-sm font-medium text-destructive">
              {state?.error}
            </p>
          ) : null}
          <div className="flex flex-col gap-3 pt-1 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-muted-foreground">
              Kişisel verilerinizin işlenmesi hakkında bilgi için{" "}
              <Link href="/yasal/gizlilik" className="font-medium text-foreground underline underline-offset-4">
                Gizlilik Politikası
              </Link>
              .
            </p>
            <button
              type="submit"
              disabled={isPending}
              className={buttonClasses({ className: "w-full sm:w-auto" })}
            >
              <Send aria-hidden className="size-4" />
              {isPending ? "Gönderiliyor..." : "Mesaj gönder"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
