import {
  BookOpen,
  Cpu,
  Globe,
  Mail,
  Network,
  Server,
  Shield,
  type LucideIcon,
} from "lucide-react";
import { createElement } from "react";
import { cn } from "@/lib/utils";
import { GridPattern } from "./grid-pattern";

const categoryIcons: Record<string, LucideIcon> = {
  domain: Globe,
  "domain-dns": Globe,
  hosting: Server,
  guvenlik: Shield,
  ssl: Shield,
  sunucu: Cpu,
  eposta: Mail,
  email: Mail,
  altyapi: Network,
  performans: Network,
};

export function categoryIcon(slug?: string | null): LucideIcon {
  return (slug && categoryIcons[slug]) || BookOpen;
}

/**
 * Monochrome generated cover for posts without an image: grid pattern,
 * category icon and label. Purely decorative.
 */
export function PostCover({
  categorySlug,
  categoryName,
  className,
  size = "md",
}: {
  categorySlug?: string | null;
  categoryName?: string | null;
  className?: string;
  size?: "md" | "lg";
}) {
  return (
    <div
      aria-hidden
      className={cn(
        "relative isolate overflow-hidden bg-gradient-to-br from-muted/80 via-muted/40 to-background",
        className
      )}
    >
      <GridPattern size={size === "lg" ? 28 : 22} className="[mask-image:radial-gradient(farthest-side_at_top_right,white,transparent_95%)]" />
      <div className="absolute inset-0 flex items-center justify-center">
        <span
          className={cn(
            "flex items-center justify-center rounded-xl border bg-background shadow-sm",
            size === "lg" ? "size-20" : "size-14"
          )}
        >
          {createElement(categoryIcon(categorySlug), {
            className: cn("text-foreground/80", size === "lg" ? "size-9" : "size-6"),
          })}
        </span>
      </div>
      {categoryName ? (
        <span className="absolute bottom-3 left-3 rounded-md border bg-background/80 px-2 py-1 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground backdrop-blur">
          {categoryName}
        </span>
      ) : null}
    </div>
  );
}
