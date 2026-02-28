import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

export default function Loading() {
  return (
    <div className="space-y-6">
      {/* Back Button */}
      <Skeleton className="h-9 w-[100px]" />

      {/* Header */}
      <div>
        <Skeleton className="h-8 w-[220px]" />
        <Skeleton className="h-4 w-[300px] mt-2" />
      </div>

      {/* Form Card */}
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-[180px]" />
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Form Fields - 2 columns */}
          <div className="grid gap-6 sm:grid-cols-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="h-4 w-[100px]" />
                <Skeleton className="h-10 w-full" />
              </div>
            ))}
          </div>
          {/* Full width field */}
          <div className="space-y-2">
            <Skeleton className="h-4 w-[100px]" />
            <Skeleton className="h-24 w-full" />
          </div>
          {/* Submit Button */}
          <div className="flex justify-end gap-3">
            <Skeleton className="h-10 w-[100px]" />
            <Skeleton className="h-10 w-[120px]" />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
