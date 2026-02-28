import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";

export default function BlogLoading() {
  return (
    <div className="flex min-h-screen flex-col">
      <main className="flex-1">
        {/* Hero */}
        <section className="py-16 md:py-24 bg-gradient-to-b from-primary/5 to-background">
          <div className="container">
            <div className="text-center mb-12">
              <Skeleton className="h-6 w-20 mx-auto mb-4 rounded-full" />
              <Skeleton className="h-12 w-96 mx-auto mb-4" />
              <Skeleton className="h-5 w-80 mx-auto" />
            </div>
            {/* Search */}
            <div className="max-w-xl mx-auto">
              <Skeleton className="h-12 w-full rounded-md" />
            </div>
          </div>
        </section>

        {/* Posts Grid */}
        <section className="py-16 md:py-24 bg-muted/30">
          <div className="container">
            <div className="grid gap-12 lg:grid-cols-4 max-w-6xl mx-auto">
              {/* Posts */}
              <div className="lg:col-span-3">
                <Skeleton className="h-8 w-40 mb-8" />
                <div className="grid gap-6 sm:grid-cols-2">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <Card key={i} className="overflow-hidden">
                      <Skeleton className="aspect-video w-full" />
                      <CardContent className="p-5">
                        <Skeleton className="h-4 w-20 mb-3 rounded-full" />
                        <Skeleton className="h-5 w-full mb-2" />
                        <Skeleton className="h-5 w-3/4 mb-3" />
                        <Skeleton className="h-4 w-full mb-1" />
                        <Skeleton className="h-4 w-2/3 mb-3" />
                        <div className="flex items-center gap-3">
                          <Skeleton className="h-3 w-20" />
                          <Skeleton className="h-3 w-24" />
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>

              {/* Sidebar */}
              <div className="lg:col-span-1 space-y-8">
                <Card>
                  <CardContent className="p-5">
                    <Skeleton className="h-5 w-24 mb-4" />
                    <div className="space-y-3">
                      {Array.from({ length: 4 }).map((_, i) => (
                        <Skeleton key={i} className="h-4 w-full" />
                      ))}
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-5">
                    <Skeleton className="h-5 w-32 mb-4" />
                    <div className="flex flex-wrap gap-2">
                      {Array.from({ length: 6 }).map((_, i) => (
                        <Skeleton key={i} className="h-6 w-16 rounded-full" />
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
