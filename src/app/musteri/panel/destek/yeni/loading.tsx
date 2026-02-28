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
          <Skeleton className="h-4 w-[280px] mt-2" />
        </div>
      </div>

      {/* Form */}
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-[150px]" />
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Konu */}
          <div className="space-y-2">
            <Skeleton className="h-4 w-[60px]" />
            <Skeleton className="h-10 w-full" />
          </div>

          {/* Departman + Oncelik */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Skeleton className="h-4 w-[90px]" />
              <Skeleton className="h-10 w-full" />
            </div>
            <div className="space-y-2">
              <Skeleton className="h-4 w-[70px]" />
              <Skeleton className="h-10 w-full" />
            </div>
          </div>

          {/* Iliskili hizmet */}
          <div className="space-y-2">
            <Skeleton className="h-4 w-[120px]" />
            <Skeleton className="h-10 w-full" />
          </div>

          {/* Mesaj */}
          <div className="space-y-2">
            <Skeleton className="h-4 w-[70px]" />
            <Skeleton className="h-32 w-full" />
          </div>

          {/* Dosya ekleme */}
          <div className="space-y-2">
            <Skeleton className="h-4 w-[80px]" />
            <Skeleton className="h-20 w-full rounded-lg" />
          </div>

          {/* Gonder butonu */}
          <div className="flex justify-end pt-2">
            <Skeleton className="h-10 w-[140px]" />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
