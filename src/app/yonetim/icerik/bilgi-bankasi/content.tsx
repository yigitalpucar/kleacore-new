"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Plus,
  Search,
  Filter,
  MoreVertical,
  Edit,
  Trash2,
  BookOpen,
  CheckCircle,
  Clock,
  Archive,
  Eye,
  Layers,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { BlurFade } from "@/components/magicui/blur-fade";
import { generateSlug } from "@/lib/utils/slug";
import {
  archiveKbArticle,
  createKbCategory,
  deleteKbArticle,
  deleteKbCategory,
  publishKbArticle,
  updateKbCategory,
} from "@/lib/actions/admin/knowledge-base";
import { toast } from "@/lib/toast";

interface KbArticleData {
  id: string;
  title: string;
  slug: string;
  status: string;
  viewCount: number;
  displayOrder: number;
  publishedAt: Date | null;
  createdAt: Date;
  category: {
    id: string;
    name: string;
    slug: string;
  };
}

interface KbCategoryData {
  id: string;
  name: string;
  slug: string;
  description: string;
  icon: string;
  displayOrder: number;
  _count: {
    articles: number;
  };
}

interface KnowledgeBaseContentProps {
  data: KbArticleData[];
  total: number;
  categories: KbCategoryData[];
  initialCategory: string;
}

const statusConfig: Record<string, { label: string; color: string }> = {
  DRAFT: { label: "Taslak", color: "bg-yellow-500/10 text-yellow-500" },
  PUBLISHED: { label: "Yayında", color: "bg-green-500/10 text-green-500" },
  ARCHIVED: { label: "Arşiv", color: "bg-zinc-500/10 text-zinc-500" },
};

export function KnowledgeBaseContent({
  data,
  total,
  categories: initialCategories,
  initialCategory,
}: KnowledgeBaseContentProps) {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState(initialCategory);
  const [statusFilter, setStatusFilter] = useState("all");
  const [isMutating, setIsMutating] = useState(false);
  const [categories, setCategories] = useState(initialCategories);
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<KbCategoryData | null>(null);
  const [categoryForm, setCategoryForm] = useState({
    name: "",
    slug: "",
    description: "",
    icon: "Book",
    displayOrder: 0,
  });

  const filteredArticles = data.filter((article) => {
    const matchesSearch =
      article.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      article.slug.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory =
      categoryFilter === "all" || article.category.id === categoryFilter;
    const matchesStatus =
      statusFilter === "all" || article.status === statusFilter;
    return matchesSearch && matchesCategory && matchesStatus;
  });

  const publishedCount = data.filter((a) => a.status === "PUBLISHED").length;
  const draftCount = data.filter((a) => a.status === "DRAFT").length;

  const handlePublish = async (id: string) => {
    if (isMutating) return;
    setIsMutating(true);
    const result = await publishKbArticle(id);
    if (!result.success) {
      toast.error(result.error ?? "Makale yayınlanamadı");
      setIsMutating(false);
      return;
    }
    toast.success("Makale yayınlandı");
    setIsMutating(false);
    router.refresh();
  };

  const handleArchive = async (id: string) => {
    if (isMutating) return;
    setIsMutating(true);
    const result = await archiveKbArticle(id);
    if (!result.success) {
      toast.error(result.error ?? "Makale arşivlenemedi");
      setIsMutating(false);
      return;
    }
    toast.success("Makale arşivlendi");
    setIsMutating(false);
    router.refresh();
  };

  const handleDelete = async (id: string) => {
    if (isMutating) return;
    if (!window.confirm("Bu makaleyi kalıcı olarak silmek istediğinize emin misiniz?")) {
      return;
    }
    setIsMutating(true);
    const result = await deleteKbArticle(id);
    if (!result.success) {
      toast.error(result.error ?? "Makale silinemedi");
      setIsMutating(false);
      return;
    }
    toast.success("Makale silindi");
    setIsMutating(false);
    router.refresh();
  };

  const openCreateCategory = () => {
    setEditingCategory(null);
    setCategoryForm({
      name: "",
      slug: "",
      description: "",
      icon: "Book",
      displayOrder: categories.length,
    });
    setCategoryDialogOpen(true);
  };

  const openEditCategory = (category: KbCategoryData) => {
    setEditingCategory(category);
    setCategoryForm({
      name: category.name,
      slug: category.slug,
      description: category.description,
      icon: category.icon,
      displayOrder: category.displayOrder,
    });
    setCategoryDialogOpen(true);
  };

  const handleCategorySubmit = async () => {
    if (!categoryForm.name.trim() || !categoryForm.slug.trim()) {
      toast.error("Kategori adı ve slug zorunludur");
      return;
    }

    setIsMutating(true);
    const result = editingCategory
      ? await updateKbCategory(editingCategory.id, categoryForm)
      : await createKbCategory(categoryForm);

    if (!result.success) {
      toast.error(result.error ?? "Kategori kaydedilemedi");
      setIsMutating(false);
      return;
    }

    toast.success(editingCategory ? "Kategori güncellendi" : "Kategori oluşturuldu");
    setCategoryDialogOpen(false);
    setIsMutating(false);
    router.refresh();
  };

  const handleDeleteCategory = async (id: string) => {
    if (!window.confirm("Bu kategoriyi silmek istediğinize emin misiniz?")) {
      return;
    }
    setIsMutating(true);
    const result = await deleteKbCategory(id);
    if (!result.success) {
      toast.error(result.error ?? "Kategori silinemedi");
      setIsMutating(false);
      return;
    }
    setCategories((prev) => prev.filter((c) => c.id !== id));
    toast.success("Kategori silindi");
    setIsMutating(false);
    router.refresh();
  };

  const formatDate = (date: Date | null) => {
    if (!date) return "-";
    return new Intl.DateTimeFormat("tr-TR", {
      day: "numeric",
      month: "short",
      year: "numeric",
    }).format(new Date(date));
  };

  return (
    <div className="space-y-6">
      <BlurFade delay={0}>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">Bilgi Bankası</h1>
            <p className="text-zinc-600 dark:text-zinc-400">Yardım makalelerini yönetin</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-primary/10">
              <BookOpen className="h-5 w-5 text-primary" />
              <span className="text-sm font-medium text-primary">{total} Makale</span>
            </div>
            <Button variant="outline" onClick={openCreateCategory}>
              <Layers className="mr-2 h-4 w-4" />
              Kategori
            </Button>
            <Button asChild className="bg-primary hover:bg-primary/90">
              <Link href="/yonetim/icerik/bilgi-bankasi/yeni">
                <Plus className="mr-2 h-4 w-4" />
                Yeni Makale
              </Link>
            </Button>
          </div>
        </div>
      </BlurFade>

      <div className="grid gap-4 md:grid-cols-3">
        <BlurFade delay={0.05}>
          <Card className="bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800">
            <CardContent className="p-4">
              <BookOpen className="h-5 w-5 text-zinc-500" />
              <p className="mt-2 text-2xl font-bold text-zinc-900 dark:text-white">{total}</p>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">Toplam Makale</p>
            </CardContent>
          </Card>
        </BlurFade>
        <BlurFade delay={0.1}>
          <Card className="bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800">
            <CardContent className="p-4">
              <CheckCircle className="h-5 w-5 text-green-500" />
              <p className="mt-2 text-2xl font-bold text-zinc-900 dark:text-white">{publishedCount}</p>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">Yayında</p>
            </CardContent>
          </Card>
        </BlurFade>
        <BlurFade delay={0.15}>
          <Card className="bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800">
            <CardContent className="p-4">
              <Clock className="h-5 w-5 text-yellow-500" />
              <p className="mt-2 text-2xl font-bold text-zinc-900 dark:text-white">{draftCount}</p>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">Taslak</p>
            </CardContent>
          </Card>
        </BlurFade>
      </div>

      <BlurFade delay={0.2}>
        <Card className="bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800">
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex items-center gap-2">
                <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                  <SelectTrigger className="w-[180px] bg-zinc-100 dark:bg-zinc-800 border-zinc-300 dark:border-zinc-700">
                    <Filter className="mr-2 h-4 w-4" />
                    <SelectValue placeholder="Kategori" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tüm Kategoriler</SelectItem>
                    {categories.map((cat) => (
                      <SelectItem key={cat.id} value={cat.id}>
                        {cat.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-[140px] bg-zinc-100 dark:bg-zinc-800 border-zinc-300 dark:border-zinc-700">
                    <SelectValue placeholder="Durum" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tüm Durumlar</SelectItem>
                    <SelectItem value="DRAFT">Taslak</SelectItem>
                    <SelectItem value="PUBLISHED">Yayında</SelectItem>
                    <SelectItem value="ARCHIVED">Arşiv</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
                <Input
                  type="search"
                  placeholder="Başlık veya slug ara..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 bg-zinc-100 dark:bg-zinc-800 border-zinc-300 dark:border-zinc-700"
                />
              </div>
            </div>
          </CardContent>
        </Card>
      </BlurFade>

      <BlurFade delay={0.25}>
        <Card className="bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-zinc-200 dark:border-zinc-800">
                    <th className="text-left p-4 text-sm font-medium text-zinc-600 dark:text-zinc-400">Başlık</th>
                    <th className="text-left p-4 text-sm font-medium text-zinc-600 dark:text-zinc-400">Kategori</th>
                    <th className="text-left p-4 text-sm font-medium text-zinc-600 dark:text-zinc-400">Durum</th>
                    <th className="text-left p-4 text-sm font-medium text-zinc-600 dark:text-zinc-400">Sıra</th>
                    <th className="text-left p-4 text-sm font-medium text-zinc-600 dark:text-zinc-400">Görüntülenme</th>
                    <th className="text-left p-4 text-sm font-medium text-zinc-600 dark:text-zinc-400">Yayın Tarihi</th>
                    <th className="text-right p-4 text-sm font-medium text-zinc-600 dark:text-zinc-400">İşlemler</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredArticles.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-zinc-500">
                        Henüz makale bulunmuyor
                      </td>
                    </tr>
                  ) : (
                    filteredArticles.map((article) => {
                      const status = statusConfig[article.status] ?? statusConfig.DRAFT;
                      return (
                        <tr
                          key={article.id}
                          className="border-b border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
                        >
                          <td className="p-4">
                            <div>
                              <p className="font-medium text-zinc-900 dark:text-white">{article.title}</p>
                              <p className="text-xs text-zinc-500 mt-0.5">/{article.slug}</p>
                            </div>
                          </td>
                          <td className="p-4 text-sm text-zinc-600 dark:text-zinc-400">
                            {article.category.name}
                          </td>
                          <td className="p-4">
                            <Badge className={status.color}>{status.label}</Badge>
                          </td>
                          <td className="p-4 text-sm text-zinc-600 dark:text-zinc-400">
                            {article.displayOrder}
                          </td>
                          <td className="p-4 text-sm text-zinc-600 dark:text-zinc-400">
                            {article.viewCount}
                          </td>
                          <td className="p-4 text-sm text-zinc-600 dark:text-zinc-400">
                            {formatDate(article.publishedAt ?? article.createdAt)}
                          </td>
                          <td className="p-4 text-right">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon">
                                  <MoreVertical className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                {article.status === "PUBLISHED" && (
                                  <DropdownMenuItem asChild>
                                    <Link
                                      href={`/bilgi-bankasi/${article.category.slug}/${article.slug}`}
                                      target="_blank"
                                    >
                                      <Eye className="mr-2 h-4 w-4" />
                                      Görüntüle
                                    </Link>
                                  </DropdownMenuItem>
                                )}
                                <DropdownMenuItem asChild>
                                  <Link href={`/yonetim/icerik/bilgi-bankasi/${article.id}/duzenle`}>
                                    <Edit className="mr-2 h-4 w-4" />
                                    Düzenle
                                  </Link>
                                </DropdownMenuItem>
                                {article.status !== "PUBLISHED" && (
                                  <DropdownMenuItem onClick={() => handlePublish(article.id)}>
                                    <CheckCircle className="mr-2 h-4 w-4" />
                                    Yayınla
                                  </DropdownMenuItem>
                                )}
                                {article.status !== "ARCHIVED" && (
                                  <DropdownMenuItem onClick={() => handleArchive(article.id)}>
                                    <Archive className="mr-2 h-4 w-4" />
                                    Arşivle
                                  </DropdownMenuItem>
                                )}
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  onClick={() => handleDelete(article.id)}
                                  className="text-red-500"
                                >
                                  <Trash2 className="mr-2 h-4 w-4" />
                                  Sil
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </BlurFade>

      {categories.length > 0 && (
        <BlurFade delay={0.3}>
          <Card className="bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800">
            <CardContent className="p-4">
              <h2 className="text-sm font-medium text-zinc-900 dark:text-white mb-3">Kategoriler</h2>
              <div className="flex flex-wrap gap-2">
                {categories.map((cat) => (
                  <Badge
                    key={cat.id}
                    variant="secondary"
                    className="gap-2 py-1.5 cursor-pointer"
                    onClick={() => openEditCategory(cat)}
                  >
                    {cat.name}
                    <span className="text-zinc-500">({cat._count.articles})</span>
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        </BlurFade>
      )}

      <Dialog open={categoryDialogOpen} onOpenChange={setCategoryDialogOpen}>
        <DialogContent className="bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800">
          <DialogHeader>
            <DialogTitle>
              {editingCategory ? "Kategori Düzenle" : "Yeni Kategori"}
            </DialogTitle>
            <DialogDescription>
              Bilgi bankası kategorisi bilgilerini girin
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid gap-2">
              <Label>Kategori Adı</Label>
              <Input
                value={categoryForm.name}
                onChange={(e) =>
                  setCategoryForm((prev) => ({
                    ...prev,
                    name: e.target.value,
                    slug: editingCategory ? prev.slug : generateSlug(e.target.value),
                  }))
                }
              />
            </div>
            <div className="grid gap-2">
              <Label>Slug</Label>
              <Input
                value={categoryForm.slug}
                onChange={(e) =>
                  setCategoryForm((prev) => ({ ...prev, slug: e.target.value }))
                }
              />
            </div>
            <div className="grid gap-2">
              <Label>Açıklama</Label>
              <Textarea
                value={categoryForm.description}
                onChange={(e) =>
                  setCategoryForm((prev) => ({ ...prev, description: e.target.value }))
                }
                rows={3}
              />
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="grid gap-2">
                <Label>İkon</Label>
                <Input
                  value={categoryForm.icon}
                  onChange={(e) =>
                    setCategoryForm((prev) => ({ ...prev, icon: e.target.value }))
                  }
                  placeholder="Book"
                />
              </div>
              <div className="grid gap-2">
                <Label>Sıralama</Label>
                <Input
                  type="number"
                  value={categoryForm.displayOrder}
                  onChange={(e) =>
                    setCategoryForm((prev) => ({
                      ...prev,
                      displayOrder: parseInt(e.target.value) || 0,
                    }))
                  }
                />
              </div>
            </div>
          </div>
          <DialogFooter className="gap-2">
            {editingCategory && (
              <Button
                variant="destructive"
                onClick={() => handleDeleteCategory(editingCategory.id)}
                disabled={isMutating}
              >
                Sil
              </Button>
            )}
            <Button variant="outline" onClick={() => setCategoryDialogOpen(false)}>
              İptal
            </Button>
            <Button onClick={handleCategorySubmit} disabled={isMutating}>
              Kaydet
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}