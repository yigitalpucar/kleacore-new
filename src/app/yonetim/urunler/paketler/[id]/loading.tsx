import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

export default function Loading() {
  return (
    <div className="space-y-6">
      {/* Back Button */}
      <Skeleton className="h-9 w-[100px]" />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Skeleton className="h-8 w-[250px]" />
          <Skeleton className="h-4 w-[180px] mt-2" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-10 w-[100px]" />
          <Skeleton className="h-10 w-[100px]" />
        </div>
      </div>

      {/* Info Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="p-6">
              <Skeleton className="h-4 w-[100px] mb-2" />
              <Skeleton className="h-8 w-[80px]" />
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Detail Sections */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-[160px]" />
          </CardHeader>
          <CardContent className="space-y-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex justify-between">
                <Skeleton className="h-4 w-[120px]" />
                <Skeleton className="h-4 w-[180px]" />
              </div>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-[160px]" />
          </CardHeader>
          <CardContent className="space-y-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex justify-between">
                <Skeleton className="h-4 w-[120px]" />
                <Skeleton className="h-4 w-[180px]" />
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Activity/History Table */}
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-[180px]" />
        </CardHeader>
        <CardContent className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
