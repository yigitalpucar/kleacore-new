"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  clearStoredIyzicoCheckoutHtml,
  readStoredIyzicoCheckoutHtml,
} from "@/lib/payments/checkout-redirect";

export default function IyzicoOdemePage() {
  const [checkoutHtml, setCheckoutHtml] = useState<string | null>(null);

  useEffect(() => {
    const html = readStoredIyzicoCheckoutHtml();
    setCheckoutHtml(html);
    if (html) {
      clearStoredIyzicoCheckoutHtml();
    }
  }, []);

  if (!checkoutHtml) {
    return (
      <div className="container py-10">
        <Card className="max-w-3xl mx-auto">
          <CardHeader>
            <CardTitle>Ödeme bilgisi bulunamadı</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              iyzico ödeme formu bulunamadı. Lütfen fatura sayfasından tekrar deneyin.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container py-10">
      <Card className="max-w-4xl mx-auto">
        <CardHeader>
          <CardTitle>Güvenli Ödeme</CardTitle>
        </CardHeader>
        <CardContent>
          <iframe
            title="iyzico Ödeme"
            srcDoc={checkoutHtml}
            sandbox="allow-forms allow-scripts allow-same-origin allow-popups"
            className="w-full min-h-[600px] border-0"
          />
        </CardContent>
      </Card>
    </div>
  );
}