import { cn } from "@/lib/utils";

function Bone({ className }: { className?: string }) {
  return <div aria-hidden className={cn("animate-pulse rounded-md bg-muted motion-reduce:animate-none", className)} />;
}

/**
 * Loading placeholder that matches the kit's page layouts. Use in loading.tsx:
 *   export default function Loading() { return <PageSkeleton variant="list" />; }
 */
export function PageSkeleton({ variant = "list" }: { variant?: "list" | "detail" | "dashboard" | "form" }) {
  return (
    <div role="status" aria-live="polite" className="space-y-6">
      <span className="sr-only">Yükleniyor…</span>
      <div className="space-y-2">
        <Bone className="h-3 w-24" />
        <Bone className="h-7 w-56" />
        <Bone className="h-4 w-80 max-w-full" />
      </div>

      {variant === "dashboard" || variant === "list" ? (
        <div className="grid grid-cols-2 gap-3 md:gap-4 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="space-y-3 rounded-lg border bg-card p-4 md:p-5">
              <Bone className="h-3 w-20" />
              <Bone className="h-7 w-12" />
              <Bone className="h-3 w-28" />
            </div>
          ))}
        </div>
      ) : null}

      {variant === "list" ? (
        <div className="rounded-lg border bg-card">
          <div className="flex gap-2 border-b p-3">
            <Bone className="h-8 w-48" />
            <Bone className="ml-auto h-8 w-56" />
          </div>
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 border-b px-4 py-4 last:border-0">
              <Bone className="h-4 w-40" />
              <Bone className="hidden h-4 w-28 md:block" />
              <Bone className="ml-auto h-6 w-20" />
            </div>
          ))}
        </div>
      ) : null}

      {variant === "dashboard" || variant === "detail" ? (
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            {Array.from({ length: 2 }).map((_, i) => (
              <div key={i} className="space-y-4 rounded-lg border bg-card p-5">
                <Bone className="h-4 w-36" />
                {Array.from({ length: 4 }).map((__, j) => (
                  <Bone key={j} className="h-4 w-full" />
                ))}
              </div>
            ))}
          </div>
          <div className="space-y-4 rounded-lg border bg-card p-5">
            <Bone className="h-4 w-28" />
            {Array.from({ length: 5 }).map((_, j) => (
              <Bone key={j} className="h-4 w-full" />
            ))}
          </div>
        </div>
      ) : null}

      {variant === "form" ? (
        <div className="space-y-4 rounded-lg border bg-card p-5">
          {Array.from({ length: 4 }).map((_, j) => (
            <div key={j} className="space-y-2">
              <Bone className="h-3 w-24" />
              <Bone className="h-10 w-full" />
            </div>
          ))}
          <Bone className="ml-auto h-9 w-32" />
        </div>
      ) : null}
    </div>
  );
}
