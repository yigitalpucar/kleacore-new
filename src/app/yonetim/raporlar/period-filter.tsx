"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";

const periodFilters = [
  { value: "7days", label: "Son 7 gün" },
  { value: "30days", label: "Son 30 gün" },
  { value: "3months", label: "Son 3 ay" },
  { value: "6months", label: "Son 6 ay" },
  { value: "1year", label: "Son 1 yıl" },
];

interface PeriodFilterProps {
  currentPeriod: string;
}

export function PeriodFilter({ currentPeriod }: PeriodFilterProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const setPeriod = (period: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("period", period);
    router.push(`?${params.toString()}`);
  };

  return (
    <div
      role="group"
      aria-label="Rapor dönemi"
      className="-mx-1 flex max-w-full gap-1 overflow-x-auto px-1 pb-0.5 [scrollbar-width:none]"
    >
      {periodFilters.map((filter) => {
        const active = currentPeriod === filter.value;
        return (
          <button
            key={filter.value}
            type="button"
            aria-pressed={active}
            onClick={() => setPeriod(filter.value)}
            className={cn(
              "inline-flex h-10 shrink-0 items-center rounded-md border px-3 text-[13px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:h-8 md:px-2.5",
              active
                ? "border-foreground bg-foreground text-background"
                : "border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            {filter.label}
          </button>
        );
      })}
    </div>
  );
}
