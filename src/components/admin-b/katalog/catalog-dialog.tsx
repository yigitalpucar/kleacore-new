"use client";

import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { appButton } from "@/components/app";
import { cn } from "@/lib/utils";

/**
 * Form dialog for catalogue editors (categories, features, promotions).
 * Structure follows shadcnblocks `companies-create5`: flush content, padded
 * title row, scrollable field grid and a bordered footer for the actions.
 * Built on the Radix primitive so the close control is labelled in Turkish.
 */
export function CatalogDialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  size = "md",
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: React.ReactNode;
  description?: React.ReactNode;
  children: React.ReactNode;
  footer: React.ReactNode;
  size?: "md" | "lg";
}) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/60 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content
          className={cn(
            "fixed left-1/2 top-1/2 z-50 flex max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-lg border bg-background text-foreground shadow-lg duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
            size === "md" ? "max-w-lg" : "max-w-2xl"
          )}
        >
          <div className="flex items-start justify-between gap-4 border-b px-5 py-4">
            <div className="min-w-0 space-y-1">
              <DialogPrimitive.Title className="text-base font-semibold tracking-tight">{title}</DialogPrimitive.Title>
              {description ? (
                <DialogPrimitive.Description className="text-[13px] text-muted-foreground">
                  {description}
                </DialogPrimitive.Description>
              ) : null}
            </div>
            <DialogPrimitive.Close className={appButton({ variant: "ghost", size: "icon-sm", className: "-mr-2 -mt-1" })}>
              <X aria-hidden />
              <span className="sr-only">Kapat</span>
            </DialogPrimitive.Close>
          </div>
          <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-5">{children}</div>
          <div className="flex flex-col-reverse gap-2 border-t bg-muted/30 px-5 py-3 sm:flex-row sm:justify-end">{footer}</div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
