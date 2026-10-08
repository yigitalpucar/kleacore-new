"use client";

import { Layers, Pencil, Plus } from "lucide-react";
import { EmptyState, FormField, SectionCard, appButton } from "@/components/app";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { fieldClass } from "./shared";

export interface CategoryListItem {
  id: string;
  name: string;
  slug: string;
  count: number;
}

/** Category overview card under a content list; each row opens the edit dialog. */
export function CategoryList({
  title,
  description,
  categories,
  countLabel,
  onEdit,
  onCreate,
}: {
  title: string;
  description?: string;
  categories: CategoryListItem[];
  countLabel: string;
  onEdit: (id: string) => void;
  onCreate: () => void;
}) {
  return (
    <SectionCard
      title={title}
      description={description}
      flush
      actions={
        <button type="button" onClick={onCreate} className={appButton({ variant: "outline", size: "sm" })}>
          <Plus aria-hidden />
          Kategori ekle
        </button>
      }
    >
      {categories.length === 0 ? (
        <div className="p-4 md:p-5">
          <EmptyState compact icon={Layers} title="Henüz kategori yok" description="İçerik eklemeden önce bir kategori oluşturun." />
        </div>
      ) : (
        <ul className="-mb-px grid overflow-hidden rounded-b-lg lg:grid-cols-2">
          {categories.map((cat) => (
            <li key={cat.id} className="border-b lg:odd:border-r">
              <button
                type="button"
                onClick={() => onEdit(cat.id)}
                className="group flex min-h-[56px] w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring md:px-5"
                aria-label={`${cat.name} kategorisini düzenle`}
              >
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium">{cat.name}</span>
                  <span className="block truncate font-mono text-xs text-muted-foreground">/{cat.slug}</span>
                </span>
                <span className="flex shrink-0 items-center gap-3">
                  <span className="text-xs tabular-nums text-muted-foreground">
                    {cat.count.toLocaleString("tr-TR")} {countLabel}
                  </span>
                  <Pencil aria-hidden className="size-4 text-muted-foreground/60 transition-colors group-hover:text-foreground" />
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </SectionCard>
  );
}

export interface CategoryFormValue {
  name: string;
  slug: string;
  description: string;
  /** Knowledge-base only. */
  icon?: string;
  /** Knowledge-base only. */
  displayOrder?: number;
}

/** Create/edit dialog for blog and knowledge-base categories. */
export function CategoryDialog({
  open,
  onOpenChange,
  title,
  description,
  idPrefix,
  form,
  onChange,
  onNameChange,
  onSubmit,
  onDelete,
  busy,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  idPrefix: string;
  form: CategoryFormValue;
  onChange: (patch: Partial<CategoryFormValue>) => void;
  onNameChange: (name: string) => void;
  onSubmit: () => void;
  onDelete?: () => void;
  busy: boolean;
}) {
  const id = (k: string) => `${idPrefix}-${k}`;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <form
          id={id("form")}
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            onSubmit();
          }}
        >
          <FormField label="Kategori adı" htmlFor={id("name")} required>
            <Input id={id("name")} value={form.name} onChange={(e) => onNameChange(e.target.value)} className={fieldClass} />
          </FormField>
          <FormField label="Slug" htmlFor={id("slug")} required>
            <Input
              id={id("slug")}
              value={form.slug}
              onChange={(e) => onChange({ slug: e.target.value })}
              className={`${fieldClass} font-mono`}
            />
          </FormField>
          <FormField label="Açıklama" htmlFor={id("description")}>
            <Textarea
              id={id("description")}
              value={form.description}
              onChange={(e) => onChange({ description: e.target.value })}
              rows={3}
            />
          </FormField>
          {form.icon !== undefined || form.displayOrder !== undefined ? (
            <div className="grid gap-4 sm:grid-cols-2">
              {form.icon !== undefined ? (
                <FormField label="İkon" htmlFor={id("icon")} hint="Lucide ikon adı, ör. Book.">
                  <Input
                    id={id("icon")}
                    value={form.icon}
                    onChange={(e) => onChange({ icon: e.target.value })}
                    placeholder="Book"
                    className={fieldClass}
                  />
                </FormField>
              ) : null}
              {form.displayOrder !== undefined ? (
                <FormField label="Sıralama" htmlFor={id("order")}>
                  <Input
                    id={id("order")}
                    type="number"
                    inputMode="numeric"
                    value={form.displayOrder}
                    onChange={(e) => onChange({ displayOrder: parseInt(e.target.value) || 0 })}
                    className={fieldClass}
                  />
                </FormField>
              ) : null}
            </div>
          ) : null}
        </form>
        <DialogFooter className="flex-col-reverse gap-2 sm:flex-row sm:justify-between">
          {onDelete ? (
            <button type="button" onClick={onDelete} disabled={busy} className={appButton({ variant: "destructive" })}>
              Sil
            </button>
          ) : (
            <span className="hidden sm:block" />
          )}
          <div className="flex flex-col-reverse gap-2 sm:flex-row">
            <button type="button" onClick={() => onOpenChange(false)} className={appButton({ variant: "outline" })}>
              İptal
            </button>
            <button type="submit" form={id("form")} disabled={busy} className={appButton()}>
              Kaydet
            </button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
