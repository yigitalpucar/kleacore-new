"use client";

import Script from "next/script";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

function PaytrCheckoutContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  if (!token) {
    return (
      <Card className="max-w-3xl mx-auto">
        <CardHeader>
          <CardTitle>Ödeme bilgisi bulunamadı</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            PayTR ödeme oturumu geçersiz. Lütfen fatura sayfasından tekrar deneyin.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Güvenli Ödeme</CardTitle>
        </CardHeader>
        <CardContent>
          <iframe
            src={`https://www.paytr.com/odeme/guvenli/${token}`}
            id="paytriframe"
            frameBorder="0"
            scrolling="no"
            style={{ width: "100%", minHeight: "600px" }}
            title="PayTR Ödeme"
          />
        </CardContent>
      </Card>
      <Script src="https://www.paytr.com/js/iframeResizer.min.js" strategy="afterInteractive" />
      <Script id="paytr-iframe-resize" strategy="afterInteractive">
        {`if (window.iFrameResize) { iFrameResize({}, '#paytriframe'); }`}
      </Script>
    </div>
  );
}

export default function PaytrOdemePage() {
  return (
    <div className="container py-10">
      <Suspense fallback={<p className="text-center text-muted-foreground">Ödeme formu yükleniyor...</p>}>
        <PaytrCheckoutContent />
      </Suspense>
    </div>
  );
}