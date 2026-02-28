import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";

export default function BlogPostLoading() {
  return (
    <div className="flex min-h-screen flex-col">
      <main className="flex-1">
        {/* Article Header */}
        <section className="py-12 md:py-16 bg-gradient-to-b from-primary/5 to-background">
          <div className="container">
            <div className="max-w-4xl mx-auto">
              {/* Breadcrumb */}
              <div className="flex items-center gap-2 mb-6">
                <Skeleton className="h-4 w-12" />
                <Skeleton className="h-4 w-4" />
                <Skeleton className="h-4 w-24" />
              </div>
              {/* Category */}
              <Skeleton className="h-6 w-28 rounded-full mb-4" />
              {/* Title */}
              <Skeleton className="h-10 w-full mb-3" />
              <Skeleton className="h-10 w-3/4 mb-6" />
              {/* Excerpt */}
              <Skeleton className="h-5 w-full mb-2" />
              <Skeleton className="h-5 w-2/3 mb-6" />
              {/* Author & Date */}
              <div className="flex items-center gap-6">
                <div className="flex items-center gap-3">
                  <Skeleton className="h-10 w-10 rounded-full" />
                  <Skeleton className="h-4 w-28" />
                </div>
                <Skeleton className="h-4 w-32" />
              </div>
            </div>
          </div>
        </section>

        {/* Article Content */}
        <section className="py-12 md:py-16">
          <div className="container">
            <div className="grid gap-12 lg:grid-cols-4 max-w-6xl mx-auto">
              {/* Main Content */}
              <div className="lg:col-span-3">
                <Card>
                  <CardContent className="p-6 md:p-10 space-y-4">
                    <Skeleton className="h-5 w-full" />
                    <Skeleton className="h-5 w-full" />
                    <Skeleton className="h-5 w-4/5" />
                    <Skeleton className="h-8 w-64 mt-6" />
                    <Skeleton className="h-5 w-full" />
                    <Skeleton className="h-5 w-full" />
                    <Skeleton className="h-5 w-3/4" />
                    <Skeleton className="h-5 w-full" />
                    <Skeleton className="h-8 w-48 mt-6" />
                    <Skeleton className="h-5 w-full" />
                    <Skeleton className="h-5 w-full" />
                    <Skeleton className="h-5 w-2/3" />
                  </CardContent>
                </Card>
              </div>

              {/* Sidebar */}
              <div className="space-y-6">
                <Card>
                  <CardContent className="p-5">
                    <Skeleton className="h-5 w-28 mb-4" />
                    <div className="space-y-3">
                      {Array.from({ length: 3 }).map((_, i) => (
                        <Skeleton key={i} className="h-4 w-full" />
                      ))}
                    </div>
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
