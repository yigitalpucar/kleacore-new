"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

/** Input/select height: 44px on phones, the denser 36px from md up. */
export const fieldClass = "h-11 md:h-9";

export type ContentStatus = "DRAFT" | "PUBLISHED" | "ARCHIVED";

export const CONTENT_STATUS_OPTIONS: { value: ContentStatus; label: string }[] = [
  { value: "DRAFT", label: "Taslak" },
  { value: "PUBLISHED", label: "Yayında" },
  { value: "ARCHIVED", label: "Arşivlendi" },
];

/**
 * Editor page layout (after shadcnblocks settings-profile4 / resource3):
 * the writing column on the left, a sticky settings column on the right.
 */
export function EditorLayout({ main, sidebar }: { main: React.ReactNode; sidebar: React.ReactNode }) {
  return (
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="min-w-0 space-y-6">{main}</div>
      <aside className="min-w-0 space-y-6 lg:sticky lg:top-20">{sidebar}</aside>
    </div>
  );
}

/** "42 / 60" counter used as a FormField hint for SEO fields. */
export function CharCount({ value, max, note }: { value: string; max: number; note?: string }) {
  const over = value.length > max;
  return (
    <span className="flex items-center justify-between gap-2">
      <span>{note}</span>
      <span className={cn("shrink-0 font-mono tabular-nums", over && "text-amber-600 dark:text-amber-400")}>
        {value.length} / {max}
      </span>
    </span>
  );
}

export function StatusSelect({
  id,
  value,
  onChange,
}: {
  id: string;
  value: ContentStatus;
  onChange: (value: ContentStatus) => void;
}) {
  return (
    <Select value={value} onValueChange={(v) => onChange(v as ContentStatus)}>
      <SelectTrigger id={id} className={fieldClass}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {CONTENT_STATUS_OPTIONS.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function CategorySelect({
  id,
  value,
  onChange,
  categories,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  categories: { id: string; name: string }[];
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger id={id} className={fieldClass}>
        <SelectValue placeholder="Kategori seçin" />
      </SelectTrigger>
      <SelectContent>
        {categories.map((cat) => (
          <SelectItem key={cat.id} value={cat.id}>
            {cat.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/** Comma-separated tag string rendered as read-only chips under the input. */
export function TagPreview({ value }: { value: string }) {
  const tags = value
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
  if (tags.length === 0) return null;
  return (
    <ul className="flex flex-wrap gap-1.5" aria-label="Etiket önizlemesi">
      {tags.map((t, i) => (
        <li key={`${t}-${i}`} className="rounded-md border bg-muted/40 px-2 py-0.5 font-mono text-[11px] text-muted-foreground">
          {t}
        </li>
      ))}
    </ul>
  );
}
