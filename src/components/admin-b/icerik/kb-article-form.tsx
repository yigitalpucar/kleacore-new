"use client";

import type { Dispatch, SetStateAction } from "react";
import { FormField, SectionCard } from "@/components/app";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  CategorySelect,
  EditorLayout,
  StatusSelect,
  TagPreview,
  fieldClass,
  type ContentStatus,
} from "./shared";

export interface KbArticleFormState {
  categoryId: string;
  title: string;
  slug: string;
  content: string;
  tags: string;
  status: ContentStatus;
  displayOrder: number;
}

/**
 * Knowledge-base article editor body shared by the new and edit pages.
 * State and server actions stay in the page's content component.
 */
export function KbArticleForm({
  formData,
  setFormData,
  onTitleChange,
  categories,
  categorySlug,
  withPlaceholders = false,
}: {
  formData: KbArticleFormState;
  setFormData: Dispatch<SetStateAction<KbArticleFormState>>;
  onTitleChange: (title: string) => void;
  categories: { id: string; name: string }[];
  /** Shown as the URL prefix of the slug field when known. */
  categorySlug?: string;
  withPlaceholders?: boolean;
}) {
  const set = <K extends keyof KbArticleFormState>(key: K, value: KbArticleFormState[K]) =>
    setFormData((prev) => ({ ...prev, [key]: value }));

  return (
    <EditorLayout
      main={
        <SectionCard title="Makale" description="Başlık, adres ve makalenin gövdesi.">
          <div className="space-y-5">
            <FormField label="Başlık" htmlFor="kb-title" required>
              <Input
                id="kb-title"
                value={formData.title}
                onChange={(e) => onTitleChange(e.target.value)}
                placeholder={withPlaceholders ? "Makale başlığı" : undefined}
                className={fieldClass}
              />
            </FormField>
            <FormField label="Slug" htmlFor="kb-slug" hint="Başlıktan otomatik oluşturulur; gerekirse düzenleyin." required>
              <div className="flex min-w-0 items-stretch overflow-hidden rounded-md border border-input bg-background focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 focus-within:ring-offset-background">
                <span className="flex min-w-0 max-w-[45%] shrink-0 items-center truncate border-r bg-muted/40 px-3 font-mono text-xs text-muted-foreground">
                  /bilgi-bankasi/{categorySlug ? `${categorySlug}/` : "…/"}
                </span>
                <input
                  id="kb-slug"
                  value={formData.slug}
                  onChange={(e) => set("slug", e.target.value)}
                  placeholder={withPlaceholders ? "makale-slug" : undefined}
                  className="h-11 min-w-0 flex-1 bg-transparent px-3 font-mono text-sm outline-none placeholder:text-muted-foreground md:h-9"
                />
              </div>
            </FormField>
            <FormField label="İçerik" htmlFor="kb-content" hint="Markdown veya düz metin.">
              <Textarea
                id="kb-content"
                value={formData.content}
                onChange={(e) => set("content", e.target.value)}
                placeholder={withPlaceholders ? "Makale içeriği (Markdown veya düz metin)…" : undefined}
                className="min-h-[280px] font-mono md:min-h-[420px] text-[13px] leading-relaxed"
              />
            </FormField>
          </div>
        </SectionCard>
      }
      sidebar={
        <>
          <SectionCard title="Yayın">
            <div className="space-y-5">
              <FormField label="Durum" htmlFor="kb-status">
                <StatusSelect id="kb-status" value={formData.status} onChange={(v) => set("status", v)} />
              </FormField>
              <FormField
                label="Kategori"
                htmlFor="kb-category"
                required
                hint={withPlaceholders && categories.length === 0 ? "Önce bilgi bankası listesinden kategori oluşturun." : undefined}
              >
                <CategorySelect
                  id="kb-category"
                  value={formData.categoryId}
                  onChange={(v) => set("categoryId", v)}
                  categories={categories}
                />
              </FormField>
              <FormField label="Sıralama" htmlFor="kb-order" hint="Küçük sayı kategoride önce gösterilir.">
                <Input
                  id="kb-order"
                  type="number"
                  inputMode="numeric"
                  value={formData.displayOrder}
                  onChange={(e) => set("displayOrder", parseInt(e.target.value) || 0)}
                  className={fieldClass}
                />
              </FormField>
            </div>
          </SectionCard>

          <SectionCard title="Etiketler">
            <div className="space-y-3">
              <FormField label="Etiketler" htmlFor="kb-tags" hint="Virgülle ayırın.">
                <Input
                  id="kb-tags"
                  value={formData.tags}
                  onChange={(e) => set("tags", e.target.value)}
                  placeholder={withPlaceholders ? "kurulum, dns, ssl" : undefined}
                  className={fieldClass}
                />
              </FormField>
              <TagPreview value={formData.tags} />
            </div>
          </SectionCard>
        </>
      }
    />
  );
}
