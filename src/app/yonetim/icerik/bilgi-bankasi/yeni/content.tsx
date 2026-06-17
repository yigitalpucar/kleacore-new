"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Save, Loader2 } from "lucide-react";
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
  const [formData, setFormData] = useState({
    categoryId: "",
    title: "",
    slug: "",
    content: "",
    tags: "",
    status: "DRAFT" as "DRAFT" | "PUBLISHED" | "ARCHIVED",
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
    <div className="space-y-6">
      <BlurFade delay={0}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/yonetim/icerik/bilgi-bankasi">
              <Button variant="ghost" size="icon">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">Yeni Makale</h1>
              <p className="text-zinc-600 dark:text-zinc-400">Bilgi bankasına yeni makale ekleyin</p>
            </div>
          </div>
          <Button onClick={handleSubmit} disabled={isSubmitting} className="bg-primary hover:bg-primary/90">
            {isSubmitting ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            {isSubmitting ? "Kaydediliyor..." : "Kaydet"}
          </Button>
        </div>
      </BlurFade>

      <BlurFade delay={0.1}>
        <Card className="bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800">
          <CardHeader>
            <CardTitle>Makale Bilgileri</CardTitle>
            <CardDescription>Bilgi bankası makalesi detaylarını girin</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-4 md:grid-cols-3">
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
                {categories.length === 0 && (
                  <p className="text-xs text-zinc-500">
                    Önce bilgi bankası listesinden kategori oluşturun
                  </p>
                )}
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
              <div className="grid gap-2">
                <Label>Sıralama</Label>
                <Input
                  type="number"
                  value={formData.displayOrder}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      displayOrder: parseInt(e.target.value) || 0,
                    }))
                  }
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="grid gap-2">
                <Label>Başlık *</Label>
                <Input
                  value={formData.title}
                  onChange={(e) => handleTitleChange(e.target.value)}
                  placeholder="Makale başlığı"
                />
              </div>
              <div className="grid gap-2">
                <Label>Slug</Label>
                <Input
                  value={formData.slug}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, slug: e.target.value }))
                  }
                  placeholder="makale-slug"
                />
              </div>
            </div>

            <div className="grid gap-2">
              <Label>İçerik</Label>
              <Textarea
                value={formData.content}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, content: e.target.value }))
                }
                placeholder="Makale içeriği..."
                className="min-h-[300px] font-mono text-sm"
              />
            </div>

            <div className="grid gap-2">
              <Label>Etiketler (virgülle ayırın)</Label>
              <Input
                value={formData.tags}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, tags: e.target.value }))
                }
                placeholder="kurulum, dns, ssl"
              />
            </div>
          </CardContent>
        </Card>
      </BlurFade>
    </div>
  );
}