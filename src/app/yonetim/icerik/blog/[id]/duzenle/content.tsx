"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckCircle, ExternalLink, Loader2, Save } from "lucide-react";
import { PageHeader, StatusBadge, appButton } from "@/components/app";
import { BlogPostForm, type BlogPostFormState } from "@/components/admin-b/icerik/blog-post-form";
import { generateSlug } from "@/lib/utils/slug";
import { updateBlogPost, publishBlogPost } from "@/lib/actions/admin/blog";
import { toast } from "@/lib/toast";

interface BlogCategoryOption {
  id: string;
  name: string;
}

interface BlogPostData {
  id: string;
  categoryId: string;
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  coverImage: string | null;
  author: string;
  tags: unknown;
  status: string;
  metaTitle: string | null;
  metaDescription: string | null;
}

interface EditBlogPostContentProps {
  post: BlogPostData;
  categories: BlogCategoryOption[];
}

export function EditBlogPostContent({ post, categories }: EditBlogPostContentProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const tagsArray = Array.isArray(post.tags) ? (post.tags as string[]) : [];

  const [formData, setFormData] = useState<BlogPostFormState>({
    categoryId: post.categoryId,
    title: post.title,
    slug: post.slug,
    excerpt: post.excerpt,
    content: post.content,
    coverImage: post.coverImage ?? "",
    author: post.author,
    tags: tagsArray.join(", "),
    status: post.status as "DRAFT" | "PUBLISHED" | "ARCHIVED",
    metaTitle: post.metaTitle ?? "",
    metaDescription: post.metaDescription ?? "",
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
      const result = await updateBlogPost(post.id, {
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
        toast.error(result.error ?? "Yazı güncellenemedi");
        return;
      }

      toast.success("Blog yazısı güncellendi");
      router.push("/yonetim/icerik/blog");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePublish = async () => {
    setIsSubmitting(true);
    try {
      const result = await publishBlogPost(post.id);
      if (!result.success) {
        toast.error(result.error ?? "Yazı yayınlanamadı");
        return;
      }
      toast.success("Yazı yayınlandı");
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
        back={{ href: "/yonetim/icerik/blog", label: "Blog yazıları" }}
        eyebrow="Blog · Düzenle"
        title={post.title}
        meta={
          <>
            <StatusBadge kind="content" status={post.status} />
            <span className="font-mono text-xs">/blog/{post.slug}</span>
          </>
        }
        actions={
          <>
            {isPublished ? (
              <Link href={`/blog/${formData.slug}`} target="_blank" className={appButton({ variant: "outline" })}>
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
            <button type="submit" form="blog-post-form" disabled={isSubmitting} className={appButton()}>
              {isSubmitting ? <Loader2 aria-hidden className="animate-spin" /> : <Save aria-hidden />}
              {isSubmitting ? "Kaydediliyor…" : "Kaydet"}
            </button>
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
        />
      </form>
    </>
  );
}
