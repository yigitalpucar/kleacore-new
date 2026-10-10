"use client";

import * as React from "react";
import { usePathname, useSearchParams } from "next/navigation";

/** Same-document navigation target of a click, or null (new tab, download, hash, external…). */
export function navigationTarget(event: MouseEvent, current: URL): URL | null {
  if (event.button !== 0) return null;
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return null;
  const anchor = (event.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
  if (!anchor) return null;
  if (anchor.target && anchor.target !== "_self") return null;
  if (anchor.hasAttribute("download") || anchor.dataset.noProgress !== undefined) return null;
  let url: URL;
  try {
    url = new URL(anchor.href, current);
  } catch {
    return null;
  }
  if (url.origin !== current.origin) return null;
  if (url.pathname === current.pathname && url.search === current.search) return null; // same page / hash link
  return url;
}

const prefersReducedMotion = () =>
  typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/**
 * Thin top progress bar for client navigations. Starts on an internal link
 * click (after 150 ms, so instant navigations never flash), trickles towards
 * 90 % and completes when the URL changes. Fixed overlay: no layout shift.
 */
export function RouteProgress() {
  return (
    <React.Suspense fallback={null}>
      <RouteProgressInner />
    </React.Suspense>
  );
}

function RouteProgressInner() {
  const pathname = usePathname();
  const search = useSearchParams()?.toString() ?? "";
  const [progress, setProgress] = React.useState<number | null>(null);
  const timers = React.useRef<{ delay?: number; trickle?: number; done?: number; safety?: number }>({});

  const clear = () => {
    const t = timers.current;
    window.clearTimeout(t.delay);
    window.clearInterval(t.trickle);
    window.clearTimeout(t.done);
    window.clearTimeout(t.safety);
    timers.current = {};
  };

  const finish = React.useCallback(() => {
    const running = timers.current.delay !== undefined || timers.current.trickle !== undefined;
    clear();
    if (!running) return;
    setProgress((p) => (p === null ? null : 1));
    timers.current.done = window.setTimeout(() => setProgress(null), 220);
  }, []);

  React.useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (!navigationTarget(event, new URL(window.location.href))) return;
      clear();
      timers.current.delay = window.setTimeout(() => {
        setProgress(0.12);
        timers.current.trickle = window.setInterval(() => {
          setProgress((p) => (p === null ? p : Math.min(0.9, p + (0.9 - p) * 0.12)));
        }, 200);
      }, 150);
      // Navigation cancelled or failed: never leave the bar hanging.
      timers.current.safety = window.setTimeout(finish, 15_000);
    };
    // Capture phase: next/link calls preventDefault() in its own handler on
    // the same root, so a bubbling listener would never see the click.
    document.addEventListener("click", onClick, true);
    return () => {
      document.removeEventListener("click", onClick, true);
      clear();
    };
  }, [finish]);

  React.useEffect(() => {
    finish();
  }, [pathname, search, finish]);

  if (progress === null) return null;
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-x-0 top-0 z-[100] h-0.5 origin-left bg-foreground transition-[transform,opacity] duration-200 ease-out motion-reduce:transition-none"
      style={{ transform: `scaleX(${progress})`, opacity: progress >= 1 ? 0 : 1 }}
    />
  );
}

/**
 * Subtle fade of the content area when the route changes (opacity only, so
 * nothing moves). Skipped on first render and with prefers-reduced-motion.
 */
export function RouteFade({ children, className }: { children: React.ReactNode; className?: string }) {
  const pathname = usePathname();
  const ref = React.useRef<HTMLDivElement>(null);
  const first = React.useRef(true);

  React.useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (prefersReducedMotion()) return;
    ref.current?.animate?.([{ opacity: 0.35 }, { opacity: 1 }], { duration: 180, easing: "ease-out" });
  }, [pathname]);

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}
