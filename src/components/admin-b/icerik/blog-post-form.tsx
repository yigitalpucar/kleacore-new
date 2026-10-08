"use client";

import type { Dispatch, SetStateAction } from "react";
import { FormField, SectionCard } from "@/components/app";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  CategorySelect,
  CharCount,
  EditorLayout,
  StatusSelect,
  TagPreview,
  fieldClass,
  type ContentStatus,
} from "./shared";

export interface BlogPostFormState {
  categoryId: string;
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  coverImage: string;
  author: string;
  tags: string;
  status: ContentStatus;
  metaTitle: string;
  metaDescription: string;
}

/**
 * Blog post editor body shared by "Yeni yazı" and "Yazıyı düzenle".
 * State and server actions stay in the page's content component.
 */
export function BlogPostForm({
  formData,
  setFormData,
  onTitleChange,
  categories,
  withPlaceholders = false,
  sidebarTop,
}: {
  formData: BlogPostFormState;
  setFormData: Dispatch<SetStateAction<BlogPostFormState>>;
  onTitleChange: (title: string) => void;
  categories: { id: string; name: string }[];
  /** The "new" page shows example placeholders and the empty-category hint. */
  withPlaceholders?: boolean;
  sidebarTop?: React.ReactNode;
}) {
  const set = <K extends keyof BlogPostFormState>(key: K, value: BlogPostFormState[K]) =>
    setFormData((prev) => ({ ...prev, [key]: value }));

  return (
    <EditorLayout
      main={
        <SectionCard title="Yazı" description="Başlık, adres, özet ve yazının gövdesi.">
          <div className="space-y-5">
            <FormField label="Başlık" htmlFor="blog-title" required>
              <Input
                id="blog-title"
                value={formData.title}
                onChange={(e) => onTitleChange(e.target.value)}
                placeholder={withPlaceholders ? "Blog yazısı başlığı" : undefined}
                className={fieldClass}
              />
            </FormField>
            <FormField label="Slug" htmlFor="blog-slug" hint="Başlıktan otomatik oluşturulur; gerekirse düzenleyin." required>
              <div className="flex min-w-0 items-stretch overflow-hidden rounded-md border border-input bg-background focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 focus-within:ring-offset-background">
                <span className="flex shrink-0 items-center border-r bg-muted/40 px-3 font-mono text-xs text-muted-foreground">
                  /blog/
                </span>
                <input
                  id="blog-slug"
                  value={formData.slug}
                  onChange={(e) => set("slug", e.target.value)}
                  placeholder={withPlaceholders ? "blog-yazisi-slug" : undefined}
                  className="h-11 min-w-0 flex-1 bg-transparent px-3 font-mono text-sm outline-none placeholder:text-muted-foreground md:h-9"
                />
              </div>
            </FormField>
            <FormField label="Özet" htmlFor="blog-excerpt" hint="Liste sayfalarında ve paylaşımlarda görünür.">
              <Textarea
                id="blog-excerpt"
                value={formData.excerpt}
                onChange={(e) => set("excerpt", e.target.value)}
                placeholder={withPlaceholders ? "Kısa özet…" : undefined}
                rows={3}
              />
            </FormField>
            <FormField label="İçerik" htmlFor="blog-content" hint="Markdown veya düz metin.">
              <Textarea
                id="blog-content"
                value={formData.content}
                onChange={(e) => set("content", e.target.value)}
                placeholder={withPlaceholders ? "Yazı içeriği (Markdown veya düz metin)…" : undefined}
                className="min-h-[280px] font-mono md:min-h-[420px] text-[13px] leading-relaxed"
              />
            </FormField>
          </div>
        </SectionCard>
      }
      sidebar={
        <>
          {sidebarTop}
          <SectionCard title="Yayın" headingLevel={2}>
            <div className="space-y-5">
              <FormField label="Durum" htmlFor="blog-status">
                <StatusSelect id="blog-status" value={formData.status} onChange={(v) => set("status", v)} />
              </FormField>
              <FormField
                label="Kategori"
                htmlFor="blog-category"
                required
                hint={withPlaceholders && categories.length === 0 ? "Önce blog listesinden kategori oluşturun." : undefined}
              >
                <CategorySelect
                  id="blog-category"
                  value={formData.categoryId}
                  onChange={(v) => set("categoryId", v)}
                  categories={categories}
                />
              </FormField>
              <FormField label="Yazar" htmlFor="blog-author">
                <Input
                  id="blog-author"
                  value={formData.author}
                  onChange={(e) => set("author", e.target.value)}
                  className={fieldClass}
                />
              </FormField>
            </div>
          </SectionCard>

          <SectionCard title="Görsel ve etiketler">
            <div className="space-y-5">
              <FormField label="Kapak görseli URL" htmlFor="blog-cover">
                <Input
                  id="blog-cover"
                  type="url"
                  inputMode="url"
                  value={formData.coverImage}
                  onChange={(e) => set("coverImage", e.target.value)}
                  placeholder={withPlaceholders ? "https://…" : undefined}
                  className={fieldClass}
                />
              </FormField>
              <FormField label="Etiketler" htmlFor="blog-tags" hint="Virgülle ayırın.">
                <Input
                  id="blog-tags"
                  value={formData.tags}
                  onChange={(e) => set("tags", e.target.value)}
                  placeholder={withPlaceholders ? "hosting, vps, sunucu" : undefined}
                  className={fieldClass}
                />
              </FormField>
              <TagPreview value={formData.tags} />
            </div>
          </SectionCard>

          <SectionCard title="SEO" description="Boş bırakılırsa başlık ve özet kullanılır.">
            <div className="space-y-5">
              <FormField
                label="Meta başlık"
                htmlFor="blog-meta-title"
                hint={<CharCount value={formData.metaTitle} max={60} />}
              >
                <Input
                  id="blog-meta-title"
                  value={formData.metaTitle}
                  onChange={(e) => set("metaTitle", e.target.value)}
                  className={fieldClass}
                />
              </FormField>
              <FormField
                label="Meta açıklama"
                htmlFor="blog-meta-description"
                hint={<CharCount value={formData.metaDescription} max={160} />}
              >
                <Textarea
                  id="blog-meta-description"
                  value={formData.metaDescription}
                  onChange={(e) => set("metaDescription", e.target.value)}
                  rows={3}
                />
              </FormField>
            </div>
          </SectionCard>
        </>
      }
    />
  );
}
