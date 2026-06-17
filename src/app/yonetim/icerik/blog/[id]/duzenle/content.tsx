"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Save, Loader2, Eye } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { BlurFade } from "@/components/magicui/blur-fade";
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

  const [formData, setFormData] = useState({
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

  return (
    <div className="space-y-6">
      <BlurFade delay={0}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/yonetim/icerik/blog">
              <Button variant="ghost" size="icon">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">Yazı Düzenle</h1>
              <p className="text-zinc-600 dark:text-zinc-400">{post.title}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {formData.status === "PUBLISHED" && (
              <Button variant="outline" asChild>
                <Link href={`/blog/${formData.slug}`} target="_blank">
                  <Eye className="mr-2 h-4 w-4" />
                  Görüntüle
                </Link>
              </Button>
            )}
            {formData.status !== "PUBLISHED" && (
              <Button variant="outline" onClick={handlePublish} disabled={isSubmitting}>
                Yayınla
              </Button>
            )}
            <Button onClick={handleSubmit} disabled={isSubmitting} className="bg-primary hover:bg-primary/90">
              {isSubmitting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-2 h-4 w-4" />
              )}
              {isSubmitting ? "Kaydediliyor..." : "Kaydet"}
            </Button>
          </div>
        </div>
      </BlurFade>

      <BlurFade delay={0.1}>
        <Card className="bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800">
          <CardHeader>
            <CardTitle>Yazı Bilgileri</CardTitle>
            <CardDescription>Blog yazısı detaylarını düzenleyin</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="grid gap-2">
                <Label>Kategori *</Label>
                <Select
                  value={formData.categoryId}
                  onValueChange={(value) =>
                    setFormData((prev) => ({ ...prev, categoryId: value }))
                  }
                >
                  <SelectTrigger>
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
              </div>
              <div className="grid gap-2">
                <Label>Durum</Label>
                <Select
                  value={formData.status}
                  onValueChange={(value) =>
                    setFormData((prev) => ({
                      ...prev,
                      status: value as "DRAFT" | "PUBLISHED" | "ARCHIVED",
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="DRAFT">Taslak</SelectItem>
                    <SelectItem value="PUBLISHED">Yayında</SelectItem>
                    <SelectItem value="ARCHIVED">Arşiv</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="grid gap-2">
                <Label>Başlık *</Label>
                <Input
                  value={formData.title}
                  onChange={(e) => handleTitleChange(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label>Slug</Label>
                <Input
                  value={formData.slug}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, slug: e.target.value }))
                  }
                />
              </div>
            </div>

            <div className="grid gap-2">
              <Label>Özet</Label>
              <Textarea
                value={formData.excerpt}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, excerpt: e.target.value }))
                }
                rows={3}
              />
            </div>

            <div className="grid gap-2">
              <Label>İçerik</Label>
              <Textarea
                value={formData.content}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, content: e.target.value }))
                }
                className="min-h-[300px] font-mono text-sm"
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="grid gap-2">
                <Label>Yazar</Label>
                <Input
                  value={formData.author}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, author: e.target.value }))
                  }
                />
              </div>
              <div className="grid gap-2">
                <Label>Kapak Görseli URL</Label>
                <Input
                  value={formData.coverImage}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, coverImage: e.target.value }))
                  }
                />
              </div>
            </div>

            <div className="grid gap-2">
              <Label>Etiketler (virgülle ayırın)</Label>
              <Input
                value={formData.tags}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, tags: e.target.value }))
                }
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="grid gap-2">
                <Label>Meta Başlık</Label>
                <Input
                  value={formData.metaTitle}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, metaTitle: e.target.value }))
                  }
                />
              </div>
              <div className="grid gap-2">
                <Label>Meta Açıklama</Label>
                <Textarea
                  value={formData.metaDescription}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, metaDescription: e.target.value }))
                  }
                  rows={2}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      </BlurFade>
    </div>
  );
}