"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CalendarRange } from "lucide-react";
import { appButton } from "@/components/app";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const periodFilters = [
  { value: "7days", label: "Son 7 gün" },
  { value: "30days", label: "Son 30 gün" },
  { value: "3months", label: "Son 3 ay" },
  { value: "6months", label: "Son 6 ay" },
  { value: "1year", label: "Son 1 yıl" },
];

interface PeriodFilterProps {
  /** Preset in effect, or "custom". */
  currentPeriod: string;
  fromDay: string;
  toDay: string;
  maxDay: string;
}

export function PeriodFilter({ currentPeriod, fromDay, toDay, maxDay }: PeriodFilterProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [from, setFrom] = useState(fromDay);
  const [to, setTo] = useState(toDay);

  const navigate = (update: (params: URLSearchParams) => void) => {
    const params = new URLSearchParams(searchParams.toString());
    update(params);
    router.push(`?${params.toString()}`);
  };

  const setPeriod = (period: string) =>
    navigate((params) => {
      params.set("period", period);
      params.delete("from");
      params.delete("to");
    });

  const applyRange = (event: React.FormEvent) => {
    event.preventDefault();
    if (!from || !to) return;
    navigate((params) => {
      params.delete("period");
      params.set("from", from);
      params.set("to", to);
    });
  };

  return (
    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
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

      <form onSubmit={applyRange} className="flex flex-wrap items-end gap-2" aria-label="Tarih aralığı">
        <label className="grid gap-1 text-xs text-muted-foreground">
          Başlangıç
          <Input
            type="date"
            value={from}
            max={to || maxDay}
            onChange={(e) => setFrom(e.target.value)}
            className="h-10 w-[150px] md:h-8"
            required
          />
        </label>
        <label className="grid gap-1 text-xs text-muted-foreground">
          Bitiş
          <Input
            type="date"
            value={to}
            min={from}
            max={maxDay}
            onChange={(e) => setTo(e.target.value)}
            className="h-10 w-[150px] md:h-8"
            required
          />
        </label>
        <button
          type="submit"
          className={appButton({ variant: currentPeriod === "custom" ? "primary" : "outline", size: "sm" })}
        >
          <CalendarRange aria-hidden />
          Uygula
        </button>
      </form>
    </div>
  );
}
