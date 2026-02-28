import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

export default function Loading() {
  return (
    <div className="space-y-6">
      {/* Baslik */}
      <div>
        <Skeleton className="h-8 w-[200px]" />
        <Skeleton className="h-4 w-[300px] mt-2" />
      </div>

      {/* Stat kartlari */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <Skeleton className="h-4 w-[90px]" />
                <Skeleton className="h-5 w-5 rounded" />
              </div>
              <Skeleton className="h-8 w-[60px] mt-2" />
              <Skeleton className="h-3 w-[110px] mt-1" />
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Son aktivite + Hızlı işlemler */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-[140px]" />
          </CardHeader>
          <CardContent className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="h-8 w-8 rounded-full" />
                <div className="flex-1 space-y-1">
                  <Skeleton className="h-4 w-[180px]" />
                  <Skeleton className="h-3 w-[120px]" />
                </div>
                <Skeleton className="h-3 w-[60px]" />
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-[130px]" />
          </CardHeader>
          <CardContent className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 p-3 rounded-lg border">
                <Skeleton className="h-10 w-10 rounded-lg" />
                <div className="flex-1">
                  <Skeleton className="h-4 w-[120px]" />
                  <Skeleton className="h-3 w-[160px] mt-1" />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
