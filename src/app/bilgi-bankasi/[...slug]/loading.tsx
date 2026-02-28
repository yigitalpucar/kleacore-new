import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";

export default function KBArticleLoading() {
  return (
    <div className="flex min-h-screen flex-col">
      <main className="flex-1">
        {/* Header */}
        <section className="py-8 md:py-12 bg-gradient-to-b from-primary/5 to-background">
          <div className="container">
            {/* Breadcrumb */}
            <div className="flex items-center gap-2 mb-6">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-4" />
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 w-4" />
              <Skeleton className="h-4 w-32" />
            </div>
            {/* Title */}
            <Skeleton className="h-10 w-full max-w-2xl mb-4" />
            <Skeleton className="h-10 w-2/3 max-w-xl mb-4" />
            {/* Meta */}
            <div className="flex items-center gap-4">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-4 w-36" />
            </div>
          </div>
        </section>

        {/* Content */}
        <section className="py-8 md:py-12">
          <div className="container">
            <div className="grid gap-8 lg:grid-cols-4">
              {/* Main Content */}
              <div className="lg:col-span-3">
                <Card>
                  <CardContent className="p-6 md:p-8 space-y-4">
                    <Skeleton className="h-5 w-full" />
                    <Skeleton className="h-5 w-full" />
                    <Skeleton className="h-5 w-3/4" />
                    <Skeleton className="h-7 w-56 mt-6" />
                    <Skeleton className="h-5 w-full" />
                    <Skeleton className="h-5 w-full" />
                    <Skeleton className="h-5 w-2/3" />
                    <Skeleton className="h-7 w-48 mt-6" />
                    <Skeleton className="h-5 w-full" />
                    <Skeleton className="h-5 w-4/5" />
                  </CardContent>
                </Card>
              </div>

              {/* Sidebar */}
              <div className="space-y-6">
                <Card>
                  <CardContent className="p-5">
                    <Skeleton className="h-5 w-20 mb-4" />
                    <div className="flex flex-wrap gap-2">
                      {Array.from({ length: 4 }).map((_, i) => (
                        <Skeleton key={i} className="h-6 w-16 rounded" />
                      ))}
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-5 space-y-3">
                    <Skeleton className="h-5 w-40" />
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-9 w-full rounded-md" />
                  </CardContent>
                </Card>
                <Skeleton className="h-10 w-full rounded-md" />
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
