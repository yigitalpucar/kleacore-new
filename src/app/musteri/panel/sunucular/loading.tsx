import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

export default function Loading() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Skeleton className="h-8 w-[160px]" />
          <Skeleton className="h-4 w-[250px] mt-2" />
        </div>
        <Skeleton className="h-10 w-[130px]" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="p-4">
              <Skeleton className="h-4 w-[80px] mb-2" />
              <Skeleton className="h-7 w-[50px]" />
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <div className="flex gap-2">
            <Skeleton className="h-10 flex-1 max-w-sm" />
            <Skeleton className="h-10 w-[100px]" />
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 p-4 rounded-lg border">
              <Skeleton className="h-10 w-10 rounded-lg" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-[200px]" />
                <Skeleton className="h-3 w-[150px]" />
              </div>
              <Skeleton className="h-6 w-[80px]" />
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
