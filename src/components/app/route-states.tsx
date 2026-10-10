"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, FileQuestion, RefreshCcw } from "lucide-react";
import { appButton } from "./button-classes";
import { EmptyState } from "./empty-state";
import { PageHeader } from "./page-header";

/**
 * Error boundary body for panel routes (rendered inside the shell, so the
 * sidebar and top bar stay usable). "Tekrar dene" re-fetches the server
 * components (router.refresh) and resets the boundary in one transition.
 */
export function AppRouteError({
  error,
  reset,
  home,
  support,
}: {
  error: Error & { digest?: string };
  reset: () => void;
  home: { href: string; label: string };
  support?: { href: string; label: string };
}) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const headingRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    console.error(error);
    headingRef.current?.focus();
  }, [error]);

  return (
    <div ref={headingRef} tabIndex={-1} className="space-y-6 focus:outline-none">
      <PageHeader title="Bir hata oluştu" description="Bu sayfa yüklenirken beklenmeyen bir sorun çıktı. Verileriniz etkilenmedi." />
      <EmptyState
        icon={AlertTriangle}
        title="Sayfa şu anda gösterilemiyor"
        description={
          <>
            Tekrar denemek genellikle sorunu çözer. Devam ederse bize bildirin.
            {error.digest ? (
              <span className="mt-2 block font-mono text-[11px] uppercase tracking-[0.12em]">Hata kodu: {error.digest}</span>
            ) : null}
          </>
        }
        action={
          <>
            <button
              type="button"
              disabled={pending}
              onClick={() =>
                startTransition(() => {
                  router.refresh();
                  reset();
                })
              }
              className={appButton({ variant: "primary" })}
            >
              <RefreshCcw aria-hidden className={pending ? "size-4 animate-spin motion-reduce:animate-none" : "size-4"} />
              {pending ? "Yeniden deneniyor…" : "Tekrar dene"}
            </button>
            <Link href={home.href} className={appButton({ variant: "outline" })}>
              {home.label}
            </Link>
            {support ? (
              <Link href={support.href} className={appButton({ variant: "ghost" })}>
                {support.label}
              </Link>
            ) : null}
          </>
        }
      />
    </div>
  );
}

/** 404 body for panel routes (notFound() in a page; the shell stays). */
export function AppRouteNotFound({
  home,
  description = "Aradığınız kayıt silinmiş, taşınmış veya bu hesaba ait olmayabilir.",
}: {
  home: { href: string; label: string };
  description?: string;
}) {
  return (
    <>
      <PageHeader title="Sayfa bulunamadı" />
      <EmptyState
        icon={FileQuestion}
        title="Bu adreste bir şey yok"
        description={description}
        action={
          <Link href={home.href} className={appButton({ variant: "outline" })}>
            {home.label}
          </Link>
        }
      />
    </>
  );
}
