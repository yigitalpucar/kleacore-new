import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

export default function Loading() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Skeleton className="h-8 w-[180px]" />
          <Skeleton className="h-4 w-[280px] mt-2" />
        </div>
        <Skeleton className="h-10 w-[140px]" />
      </div>

      {/* Search & Filters */}
      <div className="flex items-center gap-4">
        <Skeleton className="h-10 w-full max-w-sm" />
        <Skeleton className="h-10 w-[120px]" />
      </div>

      {/* Stat Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="p-6">
              <Skeleton className="h-4 w-[100px] mb-2" />
              <Skeleton className="h-8 w-[60px]" />
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Table */}
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-[150px]" />
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-4">
            <Skeleton className="h-4 w-[200px]" />
            <Skeleton className="h-4 w-[150px]" />
            <Skeleton className="h-4 w-[120px]" />
            <Skeleton className="h-4 w-[100px]" />
          </div>
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
