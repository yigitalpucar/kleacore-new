"use client";

import { Check, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Live checklist mirroring `passwordSchema` in src/lib/validations/auth.ts
 * (shadcnblocks reset-password "requirements" pattern). Display only; the
 * server action remains the source of truth.
 */
export const passwordRules: { label: string; test: (value: string) => boolean }[] = [
  { label: "En az 8 karakter", test: (v) => v.length >= 8 },
  { label: "Bir küçük harf", test: (v) => /[a-z]/.test(v) },
  { label: "Bir büyük harf", test: (v) => /[A-Z]/.test(v) },
  { label: "Bir rakam", test: (v) => /[0-9]/.test(v) },
];

export function passwordMeetsRules(value: string) {
  return passwordRules.every((rule) => rule.test(value));
}

export function PasswordRequirements({ value, id }: { value: string; id?: string }) {
  return (
    <ul id={id} className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs" aria-label="Şifre gereksinimleri">
      {passwordRules.map((rule) => {
        const ok = rule.test(value);
        return (
          <li
            key={rule.label}
            className={cn(
              "flex items-center gap-1.5 transition-colors",
              ok ? "text-foreground" : "text-muted-foreground"
            )}
          >
            <span
              aria-hidden
              className={cn(
                "inline-flex size-4 shrink-0 items-center justify-center rounded-sm border",
                ok ? "border-foreground bg-foreground text-background" : "border-border"
              )}
            >
              {ok ? <Check className="size-3" /> : <Minus className="size-3" />}
            </span>
            {rule.label}
            <span className="sr-only">{ok ? " (karşılandı)" : " (karşılanmadı)"}</span>
          </li>
        );
      })}
    </ul>
  );
}
