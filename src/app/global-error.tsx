"use client";

import { useEffect } from "react";
import "./globals.css";

/**
 * Last-resort boundary for errors thrown in the root layout itself (where
 * app/error.tsx can't render). It replaces the whole document, so it ships
 * its own <html>/<body> and avoids providers/components that might be the
 * thing that failed. The server already logged the error under `digest`.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="tr">
      <body className="flex min-h-screen items-center justify-center bg-background px-4 py-16 font-sans text-foreground antialiased">
        <main id="main" className="w-full max-w-md text-center">
          <h1 className="text-3xl font-semibold tracking-tight">Bir hata oluştu</h1>
          <p className="mt-3 text-pretty text-muted-foreground">
            Üzgünüz, sayfa yüklenirken beklenmeyen bir hata oluştu. Lütfen tekrar deneyin; sorun
            devam ederse destek ekibimizle iletişime geçin.
          </p>
          {error.digest ? (
            <p className="mt-4 font-mono text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
              Hata kodu: {error.digest}
            </p>
          ) : null}
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <button
              type="button"
              onClick={() => reset()}
              className="inline-flex h-10 items-center justify-center rounded-md bg-foreground px-5 text-sm font-medium text-background"
            >
              Tekrar dene
            </button>
            {/* Full reload on purpose: the root layout is what failed. */}
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
            <a
              href="/"
              className="inline-flex h-10 items-center justify-center rounded-md border px-5 text-sm font-medium"
            >
              Ana sayfa
            </a>
          </div>
        </main>
      </body>
    </html>
  );
}
