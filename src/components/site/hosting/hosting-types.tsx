import Link from "next/link";
import { ArrowUpRight, Building2, LayoutTemplate, Server, Users } from "lucide-react";
import { Price } from "@/components/site/price";
import { cn } from "@/lib/utils";
import type { HostingSubType } from "./data";

const TYPES: {
  key: HostingSubType;
  label: string;
  href: string;
  description: string;
  icon: typeof Server;
}[] = [
  {
    key: "linux",
    label: "Linux Hosting",
    href: "/hosting/linux",
    description: "Kişisel siteler ve küçük projeler için cPanel ve LiteSpeed.",
    icon: Server,
  },
  {
    key: "wordpress",
    label: "WordPress Hosting",
    href: "/hosting/wordpress",
    description: "LiteSpeed Cache ve WP Staging ile WordPress odaklı paketler.",
    icon: LayoutTemplate,
  },
  {
    key: "kurumsal",
    label: "Kurumsal Hosting",
    href: "/hosting/kurumsal",
    description: "Daha yüksek kaynak, Wildcard SSL ve günlük yedekleme.",
    icon: Building2,
  },
  {
    key: "reseller",
    label: "Reseller Hosting",
    href: "/hosting/reseller",
    description: "WHM ile kendi müşterilerinize cPanel hesabı açın.",
    icon: Users,
  },
];

/** Cross-links to the other hosting types with their DB starting prices. */
export function HostingTypes({
  current,
  startingPrices,
  className,
}: {
  current: HostingSubType;
  startingPrices: Partial<Record<HostingSubType, number>>;
  className?: string;
}) {
  const others = TYPES.filter((type) => type.key !== current);

  return (
    <ul className={cn("grid gap-4 md:grid-cols-3", className)}>
      {others.map((type) => {
        const from = startingPrices[type.key];
        return (
          <li key={type.key}>
            <Link
              href={type.href}
              className="group relative flex h-full flex-col rounded-2xl border bg-background p-6 transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <div className="flex items-start justify-between gap-4">
                <span className="flex size-10 items-center justify-center rounded-lg border bg-muted/40">
                  <type.icon aria-hidden className="size-5 text-foreground/80" />
                </span>
                <ArrowUpRight
                  aria-hidden
                  className="size-4 text-muted-foreground transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-foreground"
                />
              </div>
              <h3 className="mt-5 text-base font-medium tracking-tight">{type.label}</h3>
              <p className="mt-2 flex-1 text-sm leading-relaxed text-muted-foreground">
                {type.description}
              </p>
              {from ? (
                <div className="mt-5 border-t border-dashed pt-4">
                  <Price amount={from} period="ay" size="sm" from />
                </div>
              ) : null}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
