"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, Save } from "lucide-react";
import { PageHeader, appButton } from "@/components/app";
import { BlogPostForm, type BlogPostFormState } from "@/components/admin-b/icerik/blog-post-form";
import { generateSlug } from "@/lib/utils/slug";
import { createBlogPost } from "@/lib/actions/admin/blog";
import { toast } from "@/lib/toast";

interface BlogCategoryOption {
  id: string;
  name: string;
}

interface NewBlogPostContentProps {
  categories: BlogCategoryOption[];
}

export function NewBlogPostContent({ categories }: NewBlogPostContentProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState<BlogPostFormState>({
    categoryId: "",
    title: "",
    slug: "",
    excerpt: "",
    content: "",
    coverImage: "",
    author: "KLEACORE",
    tags: "",
    status: "DRAFT",
    metaTitle: "",
    metaDescription: "",
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
      const result = await createBlogPost({
        categoryId: formData.categoryId,
        title: formData.title.trim(),
        slug: formData.slug.trim(),
        excerpt: formData.excerpt.trim(),
        content: formData.content,
        coverImage: formData.coverImage.trim() || null,
        author: formData.author.trim(),
        tags: formData.tags
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean),
        status: formData.status,
        metaTitle: formData.metaTitle.trim() || null,
        metaDescription: formData.metaDescription.trim() || null,
      });

      if (!result.success) {
        toast.error(result.error ?? "Yazı oluşturulamadı");
        return;
      }

      toast.success("Blog yazısı oluşturuldu");
      router.push("/yonetim/icerik/blog");
    } finally {
      setIsSubmitting(false);
    }
  };

  const saveButton = (
    <button type="submit" form="blog-post-form" disabled={isSubmitting} className={appButton()}>
      {isSubmitting ? <Loader2 aria-hidden className="animate-spin" /> : <Save aria-hidden />}
      {isSubmitting ? "Kaydediliyor…" : "Kaydet"}
    </button>
  );

  return (
    <>
      <PageHeader
        back={{ href: "/yonetim/icerik/blog", label: "Blog yazıları" }}
        eyebrow="Blog"
        title="Yeni blog yazısı"
        description="Yazıyı taslak olarak kaydedebilir ya da doğrudan yayınlayabilirsiniz."
        actions={
          <>
            <Link href="/yonetim/icerik/blog" className={appButton({ variant: "outline" })}>
              Vazgeç
            </Link>
            {saveButton}
          </>
        }
      />
      <form
        id="blog-post-form"
        onSubmit={(e) => {
          e.preventDefault();
          void handleSubmit();
        }}
      >
        <BlogPostForm
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
