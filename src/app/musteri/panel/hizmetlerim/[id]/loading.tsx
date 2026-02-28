import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

export default function Loading() {
  return (
    <div className="space-y-6">
      {/* Geri butonu + baslik */}
      <div className="flex items-center gap-4">
        <Skeleton className="h-9 w-9 rounded-lg" />
        <div>
          <Skeleton className="h-8 w-[220px]" />
          <Skeleton className="h-4 w-[160px] mt-2" />
        </div>
      </div>

      {/* Durum ve genel bilgi */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <Skeleton className="h-6 w-[140px]" />
            <Skeleton className="h-6 w-[90px] rounded-full" />
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="space-y-1">
                <Skeleton className="h-4 w-[100px]" />
                <Skeleton className="h-5 w-[180px]" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Detay bolumu */}
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-[120px]" />
        </CardHeader>
        <CardContent className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center justify-between py-2 border-b last:border-0">
              <Skeleton className="h-4 w-[130px]" />
              <Skeleton className="h-4 w-[160px]" />
            </div>
          ))}
        </CardContent>
      </Card>

      {/* İşlem butonları */}
      <div className="flex gap-3">
        <Skeleton className="h-10 w-[120px]" />
        <Skeleton className="h-10 w-[120px]" />
      </div>
    </div>
  );
}
