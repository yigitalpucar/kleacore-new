"use client";

import { useEffect, useRef } from "react";
import { useTheme } from "next-themes";

const SCRIPT_URL = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

type TurnstileRenderOptions = {
  sitekey: string;
  action?: string;
  theme?: "light" | "dark" | "auto";
  language?: string;
  appearance?: "always" | "execute" | "interaction-only";
  size?: "normal" | "flexible" | "compact";
  callback?: (token: string) => void;
  "expired-callback"?: () => void;
  "error-callback"?: () => void;
  "timeout-callback"?: () => void;
};

type TurnstileApi = {
  render: (container: HTMLElement, options: TurnstileRenderOptions) => string;
  reset: (widgetId: string) => void;
  remove: (widgetId: string) => void;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

let scriptPromise: Promise<TurnstileApi> | null = null;

function loadTurnstile(): Promise<TurnstileApi> {
  if (window.turnstile) return Promise.resolve(window.turnstile);
  if (scriptPromise) return scriptPromise;

  scriptPromise = new Promise<TurnstileApi>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = SCRIPT_URL;
    script.async = true;
    script.defer = true;
    script.onload = () =>
      window.turnstile ? resolve(window.turnstile) : reject(new Error("turnstile missing"));
    script.onerror = () => {
      scriptPromise = null;
      reject(new Error("turnstile script failed to load"));
    };
    document.head.appendChild(script);
  });
  return scriptPromise;
}

export interface TurnstileWidgetProps {
  /** Public site key; when null (not configured, non-production) nothing renders. */
  siteKey: string | null;
  /** Widget action, verified server-side (e.g. "register", "login"). */
  action: string;
  /** Receives the token, or null when it expired / errored. */
  onToken: (token: string | null) => void;
  /** Change this value to get a fresh token (tokens are single-use). */
  resetKey?: number;
  className?: string;
}

/**
 * Cloudflare Turnstile widget (managed mode: Cloudflare decides whether an
 * interaction is needed). Follows the site theme and speaks Turkish.
 */
export function TurnstileWidget({ siteKey, action, onToken, resetKey = 0, className }: TurnstileWidgetProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);
  const onTokenRef = useRef(onToken);
  const { resolvedTheme } = useTheme();
  const theme = resolvedTheme === "dark" ? "dark" : resolvedTheme === "light" ? "light" : "auto";

  useEffect(() => {
    onTokenRef.current = onToken;
  }, [onToken]);

  useEffect(() => {
    if (!siteKey || !containerRef.current) return;
    let cancelled = false;
    const container = containerRef.current;

    loadTurnstile()
      .then((turnstile) => {
        if (cancelled) return;
        widgetIdRef.current = turnstile.render(container, {
          sitekey: siteKey,
          action,
          theme,
          language: "tr",
          appearance: "always",
          size: "flexible",
          callback: (token) => onTokenRef.current(token),
          "expired-callback": () => onTokenRef.current(null),
          "error-callback": () => onTokenRef.current(null),
          "timeout-callback": () => onTokenRef.current(null),
        });
      })
      .catch(() => onTokenRef.current(null));

    return () => {
      cancelled = true;
      const id = widgetIdRef.current;
      widgetIdRef.current = null;
      if (id && window.turnstile) window.turnstile.remove(id);
    };
  }, [siteKey, action, theme]);

  useEffect(() => {
    if (resetKey === 0) return;
    const id = widgetIdRef.current;
    if (id && window.turnstile) {
      onTokenRef.current(null);
      window.turnstile.reset(id);
    }
  }, [resetKey]);

  if (!siteKey) return null;

  return (
    <div className={className}>
      <div ref={containerRef} className="min-h-[65px]" aria-label="Güvenlik doğrulaması" />
    </div>
  );
}
