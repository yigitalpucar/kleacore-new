"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Cookie } from "lucide-react";
import { Button } from "@/components/ui/button";

export const COOKIE_CONSENT_KEY = "kleacore_cookie_consent";

export type CookieConsentValue = "accepted" | "essential";

export function CookieConsent() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const consent = localStorage.getItem(COOKIE_CONSENT_KEY);
    if (!consent) {
      setIsVisible(true);
    }
  }, []);

  const saveConsent = (value: CookieConsentValue) => {
    localStorage.setItem(COOKIE_CONSENT_KEY, value);
    setIsVisible(false);
  };

  if (!isVisible) {
    return null;
  }

  return (
    <div
      role="dialog"
      aria-labelledby="cookie-consent-title"
      aria-describedby="cookie-consent-description"
      className="fixed inset-x-0 bottom-0 z-50 animate-in slide-in-from-bottom-4 fade-in duration-300"
    >
      <div className="border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 shadow-[0_-4px_24px_rgba(0,0,0,0.08)] dark:shadow-[0_-4px_24px_rgba(0,0,0,0.3)]">
        <div className="container flex flex-col gap-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
          <div className="flex gap-3 sm:max-w-2xl">
            <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10">
              <Cookie className="h-4 w-4 text-primary" aria-hidden="true" />
            </div>
            <div className="space-y-1">
              <p id="cookie-consent-title" className="text-sm font-medium">
                Çerez Kullanımı
              </p>
              <p
                id="cookie-consent-description"
                className="text-sm text-muted-foreground leading-relaxed"
              >
                Deneyiminizi iyileştirmek için çerezler kullanıyoruz. Tüm çerezleri
                kabul edebilir veya yalnızca zorunlu çerezlerle devam edebilirsiniz.{" "}
                <Link
                  href="/yasal/cerez"
                  className="font-medium text-primary underline-offset-4 hover:underline"
                >
                  Çerez Politikası
                </Link>
              </p>
            </div>
          </div>

          <div className="flex shrink-0 flex-col-reverse gap-2 sm:flex-row sm:items-center">
            <Button
              variant="outline"
              size="sm"
              onClick={() => saveConsent("essential")}
              className="w-full sm:w-auto"
            >
              Yalnızca Zorunlu
            </Button>
            <Button
              size="sm"
              onClick={() => saveConsent("accepted")}
              className="w-full sm:w-auto"
            >
              Kabul Et
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}