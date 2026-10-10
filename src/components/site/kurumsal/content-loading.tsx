import { Container } from "@/components/site/container";
import { SiteShell } from "./site-shell";

function Bar({ className }: { className: string }) {
  return <div aria-hidden className={`animate-pulse rounded-md bg-muted motion-reduce:animate-none ${className}`} />;
}

/**
 * Loading skeleton for public data routes (keeps the site frame): blog /
 * knowledge-base lists and articles, and "plans" for product pages (hero +
 * plan cards).
 */
export function ContentLoading({ variant = "list" }: { variant?: "list" | "article" | "plans" }) {
  return (
    <SiteShell>
      <div role="status" aria-label="Yükleniyor" className="border-b">
        <Container className="py-14 md:py-20">
          <div className={variant === "article" ? "max-w-3xl" : "mx-auto flex max-w-3xl flex-col items-center"}>
            <Bar className="h-3 w-40" />
            <Bar className="mt-6 h-10 w-full max-w-md" />
            <Bar className="mt-4 h-4 w-full max-w-lg" />
          </div>
        </Container>
      </div>
      <Container className="py-12">
        {variant === "plans" ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }, (_, i) => (
              <div key={i} className="space-y-4 rounded-xl border p-6">
                <Bar className="h-4 w-24" />
                <Bar className="h-9 w-32" />
                <Bar className="h-3 w-full" />
                {Array.from({ length: 5 }, (__, j) => (
                  <Bar key={j} className="h-3 w-4/5" />
                ))}
                <Bar className="h-10 w-full" />
              </div>
            ))}
          </div>
        ) : variant === "list" ? (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }, (_, i) => (
              <div key={i} className="overflow-hidden rounded-xl border">
                <Bar className="aspect-[16/9] rounded-none" />
                <div className="space-y-3 p-5">
                  <Bar className="h-3 w-24" />
                  <Bar className="h-4 w-full" />
                  <Bar className="h-4 w-2/3" />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="max-w-3xl space-y-4 lg:ml-[19rem]">
            {Array.from({ length: 8 }, (_, i) => (
              <Bar key={i} className={i % 3 === 0 ? "h-6 w-1/2" : "h-4 w-full"} />
            ))}
          </div>
        )}
      </Container>
    </SiteShell>
  );
}
