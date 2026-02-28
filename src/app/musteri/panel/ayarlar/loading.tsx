import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

export default function Loading() {
  return (
    <div className="space-y-6">
      {/* Baslik */}
      <div>
        <Skeleton className="h-8 w-[160px]" />
        <Skeleton className="h-4 w-[280px] mt-2" />
      </div>

      {/* Tab navigation */}
      <div className="flex gap-2 border-b pb-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-9 w-[100px]" />
        ))}
      </div>

      {/* Form alanlari */}
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-[140px]" />
          <Skeleton className="h-4 w-[220px] mt-1" />
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="h-4 w-[90px]" />
                <Skeleton className="h-10 w-full" />
              </div>
            ))}
          </div>
          <div className="flex justify-end pt-4">
            <Skeleton className="h-10 w-[130px]" />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
