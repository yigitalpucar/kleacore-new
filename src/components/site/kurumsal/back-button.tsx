"use client";

import { ArrowLeft } from "lucide-react";
import { buttonClasses } from "@/components/site/button-classes";

/** "Go back" button (browser history). */
export function BackButton({ label = "Önceki sayfaya dön" }: { label?: string }) {
  return (
    <button
      type="button"
      onClick={() => window.history.back()}
      className={buttonClasses({ variant: "ghost" })}
    >
      <ArrowLeft aria-hidden className="size-4" />
      {label}
    </button>
  );
}
