"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckCircle, ExternalLink, Loader2, Save } from "lucide-react";
import { PageHeader, StatusBadge, appButton } from "@/components/app";
import { KbArticleForm, type KbArticleFormState } from "@/components/admin-b/icerik/kb-article-form";
import { generateSlug } from "@/lib/utils/slug";
import { updateKbArticle, publishKbArticle } from "@/lib/actions/admin/knowledge-base";
import { toast } from "@/lib/toast";

interface KbCategoryOption {
  id: string;
  name: string;
  slug: string;
}

interface KbArticleData {
  id: string;
  categoryId: string;
  title: string;
  slug: string;
  content: string;
  tags: unknown;
  status: string;
  displayOrder: number;
  category: {
    slug: string;
  };
}

interface EditKbArticleContentProps {
  article: KbArticleData;
  categories: KbCategoryOption[];
}

export function EditKbArticleContent({ article, categories }: EditKbArticleContentProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const tagsArray = Array.isArray(article.tags) ? (article.tags as string[]) : [];

  const [formData, setFormData] = useState<KbArticleFormState>({
    categoryId: article.categoryId,
    title: article.title,
    slug: article.slug,
    content: article.content,
    tags: tagsArray.join(", "),
    status: article.status as "DRAFT" | "PUBLISHED" | "ARCHIVED",
    displayOrder: article.displayOrder,
  });

  const categorySlug =
    categories.find((c) => c.id === formData.categoryId)?.slug ?? article.category.slug;

  const handleTitleChange = (title: string) => {
    setFormData((prev) => ({
      ...prev,
      title,
      slug: generateSlug(title),
    }));
  };

  const handleSubmit = async () => {
    if (!formData.categoryId) {
      toast.error("Lütfen bir kategori seçin");
      return;
    }
    if (!formData.title.trim() || !formData.slug.trim()) {
      toast.error("Başlık ve slug zorunludur");
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await updateKbArticle(article.id, {
        categoryId: formData.categoryId,
        title: formData.title.trim(),
        slug: formData.slug.trim(),
        content: formData.content,
        tags: formData.tags
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean),
        status: formData.status,
        displayOrder: formData.displayOrder,
      });

      if (!result.success) {
        toast.error(result.error ?? "Makale güncellenemedi");
        return;
      }

      toast.success("Makale güncellendi");
      router.push("/yonetim/icerik/bilgi-bankasi");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePublish = async () => {
    setIsSubmitting(true);
    try {
      const result = await publishKbArticle(article.id);
      if (!result.success) {
        toast.error(result.error ?? "Makale yayınlanamadı");
        return;
      }
      toast.success("Makale yayınlandı");
      setFormData((prev) => ({ ...prev, status: "PUBLISHED" }));
      router.refresh();
    } finally {
      setIsSubmitting(false);
    }
  };

  const isPublished = formData.status === "PUBLISHED";

  return (
    <>
      <PageHeader
        back={{ href: "/yonetim/icerik/bilgi-bankasi", label: "Bilgi bankası" }}
        eyebrow="Bilgi bankası · Düzenle"
        title={article.title}
        meta={
          <>
            <StatusBadge kind="content" status={article.status} />
            <span className="break-all font-mono text-xs">
              /bilgi-bankasi/{article.category.slug}/{article.slug}
            </span>
          </>
        }
        actions={
          <>
            {isPublished ? (
              <Link
                href={`/bilgi-bankasi/${categorySlug}/${formData.slug}`}
                target="_blank"
                className={appButton({ variant: "outline" })}
              >
                <ExternalLink aria-hidden />
                Görüntüle
              </Link>
            ) : (
              <button
                type="button"
                onClick={handlePublish}
                disabled={isSubmitting}
                className={appButton({ variant: "outline" })}
              >
                <CheckCircle aria-hidden />
                Yayınla
              </button>
            )}
            <button type="submit" form="kb-article-form" disabled={isSubmitting} className={appButton()}>
              {isSubmitting ? <Loader2 aria-hidden className="animate-spin" /> : <Save aria-hidden />}
              {isSubmitting ? "Kaydediliyor…" : "Kaydet"}
            </button>
          </>
        }
      />
      <form
        id="kb-article-form"
        onSubmit={(e) => {
          e.preventDefault();
          void handleSubmit();
        }}
      >
        <KbArticleForm
          formData={formData}
          setFormData={setFormData}
          onTitleChange={handleTitleChange}
          categories={categories}
          categorySlug={categorySlug}
        />
      </form>
    </>
  );
}
