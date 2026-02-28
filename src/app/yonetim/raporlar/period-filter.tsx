"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const periodFilters = [
  { value: "7days", label: "Son 7 Gün" },
  { value: "30days", label: "Son 30 Gün" },
  { value: "3months", label: "Son 3 Ay" },
  { value: "6months", label: "Son 6 Ay" },
  { value: "1year", label: "Son 1 Yıl" },
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
    <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide">
      {periodFilters.map((filter) => (
        <Button
          key={filter.value}
          variant={currentPeriod === filter.value ? "default" : "outline"}
          onClick={() => setPeriod(filter.value)}
          className={cn(
            "whitespace-nowrap",
            currentPeriod === filter.value
              ? "bg-primary hover:bg-primary/90"
              : "bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800"
          )}
        >
          <Calendar className="h-4 w-4 mr-2" />
          {filter.label}
        </Button>
      ))}
    </div>
  );
}
