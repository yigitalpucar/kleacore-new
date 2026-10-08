"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, Save } from "lucide-react";
import { PageHeader, appButton } from "@/components/app";
import { KbArticleForm, type KbArticleFormState } from "@/components/admin-b/icerik/kb-article-form";
import { generateSlug } from "@/lib/utils/slug";
import { createKbArticle } from "@/lib/actions/admin/knowledge-base";
import { toast } from "@/lib/toast";

interface KbCategoryOption {
  id: string;
  name: string;
}

interface NewKbArticleContentProps {
  categories: KbCategoryOption[];
}

export function NewKbArticleContent({ categories }: NewKbArticleContentProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState<KbArticleFormState>({
    categoryId: "",
    title: "",
    slug: "",
    content: "",
    tags: "",
    status: "DRAFT",
    displayOrder: 0,
  });

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
      const result = await createKbArticle({
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
        toast.error(result.error ?? "Makale oluşturulamadı");
        return;
      }

      toast.success("Makale oluşturuldu");
      router.push("/yonetim/icerik/bilgi-bankasi");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <PageHeader
        back={{ href: "/yonetim/icerik/bilgi-bankasi", label: "Bilgi bankası" }}
        eyebrow="Bilgi bankası"
        title="Yeni makale"
        description="Bilgi bankasına yeni bir yardım makalesi ekleyin."
        actions={
          <>
            <Link href="/yonetim/icerik/bilgi-bankasi" className={appButton({ variant: "outline" })}>
              Vazgeç
            </Link>
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
          withPlaceholders
        />
      </form>
    </>
  );
}
