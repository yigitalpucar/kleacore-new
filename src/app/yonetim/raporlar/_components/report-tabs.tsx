import Link from "next/link";
import { Banknote, Calculator, Globe, Package, Receipt, Repeat, Users, Wallet } from "lucide-react";
import { cn } from "@/lib/utils";

export const REPORT_TABS = [
  { key: "revenue", label: "Gelir", icon: Banknote },
  { key: "mrr", label: "MRR & churn", icon: Repeat },
  { key: "collections", label: "Tahsilat", icon: Wallet },
  { key: "kdv", label: "KDV", icon: Receipt },
  { key: "domains", label: "Domain kârı", icon: Globe },
  { key: "customers", label: "Müşteriler", icon: Users },
  { key: "services", label: "Hizmetler", icon: Package },
  { key: "accounting", label: "Muhasebe", icon: Calculator },
] as const;

export type ReportTab = (typeof REPORT_TABS)[number]["key"];

export function parseReportTab(value: string | string[] | undefined): ReportTab {
  const raw = Array.isArray(value) ? value[0] : value;
  return REPORT_TABS.some((t) => t.key === raw) ? (raw as ReportTab) : "revenue";
}

/** Link tabs: only the active tab's data is loaded on the server. */
export function ReportTabs({ active, query }: { active: ReportTab; query: string }) {
  return (
    <nav aria-label="Rapor bölümleri" className="-mx-1 overflow-x-auto px-1 [scrollbar-width:none]">
      <ul className="flex w-max min-w-full gap-1 border-b">
        {REPORT_TABS.map(({ key, label, icon: Icon }) => {
          const current = key === active;
          return (
            <li key={key}>
              <Link
                href={`?${query}&tab=${key}`}
                scroll={false}
                aria-current={current ? "page" : undefined}
                className={cn(
                  "-mb-px inline-flex h-11 shrink-0 items-center gap-2 border-b-2 px-3 text-sm transition-colors md:h-10 [&_svg]:size-4",
                  current
                    ? "border-foreground text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                )}
              >
                <Icon aria-hidden />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
