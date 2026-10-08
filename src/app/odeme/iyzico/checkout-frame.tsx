"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { FileText, Lock } from "lucide-react";
import { buttonClasses } from "@/components/site/button-classes";
import {
  clearStoredIyzicoCheckoutHtml,
  readStoredIyzicoCheckoutHtml,
} from "@/lib/payments/checkout-redirect";

export function IyzicoCheckoutFrame() {
  const [checkoutHtml, setCheckoutHtml] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const html = readStoredIyzicoCheckoutHtml();
    setCheckoutHtml(html);
    setReady(true);
    if (html) {
      clearStoredIyzicoCheckoutHtml();
    }
  }, []);

  if (!ready) {
    return <div aria-hidden className="h-[600px] animate-pulse rounded-2xl border bg-muted/40" />;
  }

  if (!checkoutHtml) {
    return (
      <div className="rounded-2xl border border-dashed px-6 py-12 text-center">
        <h2 className="text-lg font-semibold tracking-tight">Ödeme bilgisi bulunamadı</h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
          iyzico ödeme formu bulunamadı. Lütfen fatura sayfasından tekrar deneyin.
        </p>
        <Link href="/musteri/panel/faturalar" className={buttonClasses({ className: "mt-6" })}>
          <FileText aria-hidden className="size-4" />
          Faturalarım
        </Link>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border bg-background">
      <div className="flex items-center gap-2 border-b px-5 py-3 text-xs text-muted-foreground">
        <Lock aria-hidden className="size-3.5" />
        <span className="font-mono uppercase tracking-[0.14em]">Güvenli ödeme · iyzico</span>
      </div>
      <iframe
        title="iyzico Ödeme"
        srcDoc={checkoutHtml}
        sandbox="allow-forms allow-scripts allow-same-origin allow-popups"
        className="min-h-[600px] w-full border-0 bg-white"
      />
    </div>
  );
}
