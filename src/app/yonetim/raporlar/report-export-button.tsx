"use client";

import { useTransition } from "react";
import { ChevronDown, Download, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "@/lib/toast";

interface ReportExportButtonProps {
  period: string;
}

function getFileNameFromDisposition(disposition: string | null) {
  if (!disposition) return null;
  const match = disposition.match(/filename\*?=(?:UTF-8''|")?([^";\n]+)/i);
  if (!match?.[1]) return null;
  return decodeURIComponent(match[1].replace(/"/g, "").trim());
}

export function ReportExportButton({ period }: ReportExportButtonProps) {
  const [isPending, startTransition] = useTransition();

  const handleExport = (format: "csv" | "pdf") => {
    startTransition(async () => {
      try {
        const response = await fetch(
          `/api/admin/reports/export?period=${encodeURIComponent(period)}&format=${format}`,
          {
            method: "GET",
            cache: "no-store",
          }
        );

        if (!response.ok) {
          let errorMessage = "Rapor indirilemedi";
          const contentType = response.headers.get("content-type") ?? "";
          if (contentType.includes("application/json")) {
            const data = (await response.json()) as { error?: string };
            if (data.error) errorMessage = data.error;
          }
          throw new Error(errorMessage);
        }

        const blob = await response.blob();
        const fileName =
          getFileNameFromDisposition(response.headers.get("content-disposition")) ??
          "rapor.csv";
        const objectUrl = URL.createObjectURL(blob);

        const link = document.createElement("a");
        link.href = objectUrl;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(objectUrl);

        toast.success(format === "pdf" ? "PDF raporu indirildi" : "CSV raporu indirildi");
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Rapor indirilemedi";
        toast.error(message);
      }
    });
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          className="bg-primary hover:bg-primary/90"
          disabled={isPending}
        >
          <Download className="h-4 w-4 mr-2" />
          {isPending ? "Hazırlanıyor..." : "Rapor İndir"}
          <ChevronDown className="h-4 w-4 ml-2" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuItem
          disabled={isPending}
          onSelect={() => handleExport("csv")}
          className="cursor-pointer"
        >
          <Download className="h-4 w-4 mr-2" />
          CSV İndir
        </DropdownMenuItem>
        <DropdownMenuItem
          disabled={isPending}
          onSelect={() => handleExport("pdf")}
          className="cursor-pointer"
        >
          <FileText className="h-4 w-4 mr-2" />
          PDF İndir
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
