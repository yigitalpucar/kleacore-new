"use client";

import Link from "next/link";
import Script from "next/script";
import { useSearchParams } from "next/navigation";
import { FileText, Lock } from "lucide-react";
import { buttonClasses } from "@/components/site/button-classes";

export function PaytrCheckoutFrame() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  if (!token) {
    return (
      <div className="rounded-2xl border border-dashed px-6 py-12 text-center">
        <h2 className="text-lg font-semibold tracking-tight">Ödeme bilgisi bulunamadı</h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
          PayTR ödeme oturumu geçersiz. Lütfen fatura sayfasından tekrar deneyin.
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
        <span className="font-mono uppercase tracking-[0.14em]">Güvenli ödeme · PayTR</span>
      </div>
      <iframe
        src={`https://www.paytr.com/odeme/guvenli/${token}`}
        id="paytriframe"
        frameBorder="0"
        scrolling="no"
        style={{ width: "100%", minHeight: "600px" }}
        className="bg-white"
        title="PayTR Ödeme"
      />
      <Script src="https://www.paytr.com/js/iframeResizer.min.js" strategy="afterInteractive" />
      <Script id="paytr-iframe-resize" strategy="afterInteractive">
        {`if (window.iFrameResize) { iFrameResize({}, '#paytriframe'); }`}
      </Script>
    </div>
  );
}
