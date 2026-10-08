"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { appButton } from "@/components/app";
import { cn } from "@/lib/utils";

/**
 * Pager for admin lists that are paginated on the server (`?page=`).
 * The DataTable above it searches / filters the rows of the current server
 * page; this moves between server pages and keeps every other query param.
 * Renders nothing when everything fits on one page.
 */
export function ServerPager({
  page,
  totalPages,
  total,
  noun = "kayıt",
  className,
}: {
  page: number;
  totalPages: number;
  total: number;
  /** "müşteri", "sipariş"… */
  noun?: string;
  className?: string;
}) {
  const pathname = usePathname() ?? "";
  const searchParams = useSearchParams();
  if (totalPages <= 1) return null;

  const hrefFor = (p: number) => {
    const sp = new URLSearchParams(searchParams?.toString());
    if (p <= 1) sp.delete("page");
    else sp.set("page", String(p));
    const qs = sp.toString();
    return qs ? `${pathname}?${qs}` : pathname;
  };

  const prevDisabled = page <= 1;
  const nextDisabled = page >= totalPages;

  return (
    <nav
      aria-label="Sunucu sayfaları"
      className={cn(
        "flex flex-col gap-3 rounded-lg border border-dashed px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between",
        className
      )}
    >
      <p className="text-muted-foreground">
        Toplam <span className="font-medium tabular-nums text-foreground">{total.toLocaleString("tr-TR")}</span> {noun} ·
        sayfa <span className="tabular-nums">{page}</span> / <span className="tabular-nums">{totalPages}</span>
        <span className="block text-xs">Arama ve filtreler yalnızca bu sayfadaki kayıtlarda çalışır.</span>
      </p>
      <div className="flex gap-2">
        {prevDisabled ? (
          <span aria-disabled className={cn(appButton({ variant: "outline", size: "sm" }), "pointer-events-none opacity-50")}>
            <ChevronLeft aria-hidden />
            Önceki
          </span>
        ) : (
          <Link href={hrefFor(page - 1)} className={appButton({ variant: "outline", size: "sm" })}>
            <ChevronLeft aria-hidden />
            Önceki
          </Link>
        )}
        {nextDisabled ? (
          <span aria-disabled className={cn(appButton({ variant: "outline", size: "sm" }), "pointer-events-none opacity-50")}>
            Sonraki
            <ChevronRight aria-hidden />
          </span>
        ) : (
          <Link href={hrefFor(page + 1)} className={appButton({ variant: "outline", size: "sm" })}>
            Sonraki
            <ChevronRight aria-hidden />
          </Link>
        )}
      </div>
    </nav>
  );
}
