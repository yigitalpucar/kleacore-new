"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, Home, LifeBuoy, RefreshCcw } from "lucide-react";
import { buttonClasses } from "@/components/site/button-classes";
import { GridBackground } from "@/components/site/grid-lines";
import { Eyebrow } from "@/components/site/eyebrow";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log the error to an error reporting service
    console.error(error);
  }, [error]);

  return (
    <main
      id="main"
      className="relative isolate flex min-h-screen items-center justify-center overflow-hidden bg-background px-4 py-16"
    >
      <GridBackground className="-z-10" mask="center" />
      <div className="w-full max-w-md text-center">
        <span className="mx-auto flex size-14 items-center justify-center rounded-xl border bg-background shadow-sm">
          <AlertTriangle aria-hidden className="size-6 text-foreground" />
        </span>
        <Eyebrow className="mt-6">Beklenmeyen hata</Eyebrow>
        <h1 className="mt-3 text-balance text-3xl font-semibold tracking-tight">Bir hata oluştu</h1>
        <p className="mt-3 text-pretty text-muted-foreground">
          Üzgünüz, beklenmeyen bir hata oluştu. Lütfen tekrar deneyin veya sorun devam ederse destek
          ekibimizle iletişime geçin.
        </p>

        {process.env.NODE_ENV === "development" && (
          <div className="mt-6 overflow-auto rounded-lg border bg-muted/40 p-4 text-left">
            <p className="break-all font-mono text-sm text-destructive">{error.message}</p>
          </div>
        )}
        {error.digest ? (
          <p className="mt-4 font-mono text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
            Hata kodu: {error.digest}
          </p>
        ) : null}

        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          <button type="button" onClick={reset} className={buttonClasses()}>
            <RefreshCcw aria-hidden className="size-4" />
            Tekrar dene
          </button>
          <Link href="/" className={buttonClasses({ variant: "outline" })}>
            <Home aria-hidden className="size-4" />
            Ana sayfa
          </Link>
        </div>

        <div className="mt-10 border-t pt-6">
          <p className="text-sm text-muted-foreground">Sorun devam ediyor mu?</p>
          <Link href="/iletisim" className={buttonClasses({ variant: "ghost", className: "mt-2" })}>
            <LifeBuoy aria-hidden className="size-4" />
            Destek ekibine ulaşın
          </Link>
        </div>
      </div>
    </main>
  );
}
