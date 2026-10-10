"use client";

import { usePathname } from "next/navigation";

/** Renders children everywhere except on exactly `path` (that page shows its own variant). */
export function HiddenOnPath({ path, children }: { path: string; children: React.ReactNode }) {
  const pathname = usePathname();
  if (pathname === path || pathname === `${path}/`) return null;
  return <>{children}</>;
}
