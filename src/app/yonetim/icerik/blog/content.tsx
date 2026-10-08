"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Archive, CheckCircle, ExternalLink, FileText, Layers, Pencil, Plus, Trash2 } from "lucide-react";
import {
  DataTable,
  EmptyState,
  ListRow,
  PageHeader,
  StatCard,
  StatGrid,
  StatusBadge,
  appButton,
  getStatusOptions,
  type ColumnDef,
  type RowAction,
} from "@/components/app";
import { CategoryDialog, CategoryList } from "@/components/admin-b/icerik/category-manager";
import { formatDate } from "@/lib/format/date";
import { generateSlug } from "@/lib/utils/slug";
import {
  archiveBlogPost,
  createBlogCategory,
  deleteBlogCategory,
  deleteBlogPost,
  publishBlogPost,
  updateBlogCategory,
} from "@/lib/actions/admin/blog";
import { toast } from "@/lib/toast";

interface BlogPostData {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  status: string;
  author: string;
  viewCount: number;
  publishedAt: Date | null;
  createdAt: Date;
  category: {
    id: string;
    name: string;
    slug: string;
  };
}

interface BlogCategoryData {
  id: string;
  name: string;
  slug: string;
  description: string;
  _count: {
    posts: number;
  };
}

interface BlogContentProps {
  data: BlogPostData[];
  total: number;
  categories: BlogCategoryData[];
  initialCategory: string;
}

export function BlogContent({
  data,
  total,
  categories: initialCategories,
  initialCategory,
}: BlogContentProps) {
  const router = useRouter();
  const [isMutating, setIsMutating] = useState(false);
  const [categories, setCategories] = useState(initialCategories);
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<BlogCategoryData | null>(null);
  const [categoryForm, setCategoryForm] = useState({
    name: "",
    slug: "",
    description: "",
  });

  const publishedCount = data.filter((p) => p.status === "PUBLISHED").length;
  const draftCount = data.filter((p) => p.status === "DRAFT").length;

  const handlePublish = async (id: string) => {
    if (isMutating) return;
    setIsMutating(true);
    const result = await publishBlogPost(id);
    if (!result.success) {
      toast.error(result.error ?? "Yazı yayınlanamadı");
      setIsMutating(false);
      return;
    }
    toast.success("Yazı yayınlandı");
    setIsMutating(false);
    router.refresh();
  };

  const handleArchive = async (id: string) => {
    if (isMutating) return;
    setIsMutating(true);
    const result = await archiveBlogPost(id);
    if (!result.success) {
      toast.error(result.error ?? "Yazı arşivlenemedi");
      setIsMutating(false);
      return;
    }
    toast.success("Yazı arşivlendi");
    setIsMutating(false);
    router.refresh();
  };

  const handleDelete = async (id: string) => {
    if (isMutating) return;
    if (!window.confirm("Bu yazıyı kalıcı olarak silmek istediğinize emin misiniz?")) {
      return;
    }
    setIsMutating(true);
    const result = await deleteBlogPost(id);
    if (!result.success) {
      toast.error(result.error ?? "Yazı silinemedi");
      setIsMutating(false);
      return;
    }
    toast.success("Yazı silindi");
    setIsMutating(false);
    router.refresh();
  };

  const openCreateCategory = () => {
    setEditingCategory(null);
    setCategoryForm({ name: "", slug: "", description: "" });
    setCategoryDialogOpen(true);
  };

  const openEditCategory = (category: BlogCategoryData) => {
    setEditingCategory(category);
    setCategoryForm({
      name: category.name,
      slug: category.slug,
      description: category.description,
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
      ? await updateBlogCategory(editingCategory.id, categoryForm)
      : await createBlogCategory(categoryForm);

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
    const result = await deleteBlogCategory(id);
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

  const editHref = (post: BlogPostData) => `/yonetim/icerik/blog/${post.id}/duzenle`;

  const columns: ColumnDef<BlogPostData>[] = [
    {
      accessorKey: "title",
      header: "Başlık",
      cell: ({ row }) => (
        <div className="min-w-0 max-w-[420px]">
          <Link href={editHref(row.original)} className="font-medium hover:underline">
            {row.original.title}
          </Link>
          <p className="truncate font-mono text-xs text-muted-foreground">/{row.original.slug}</p>
        </div>
      ),
    },
    {
      id: "category",
      accessorFn: (r) => r.category.name,
      header: "Kategori",
      cell: ({ row }) => <span className="text-muted-foreground">{row.original.category.name}</span>,
    },
    {
      accessorKey: "status",
      header: "Durum",
      enableSorting: false,
      cell: ({ row }) => <StatusBadge kind="content" status={row.original.status} />,
    },
    {
      accessorKey: "viewCount",
      header: "Görüntülenme",
      meta: { align: "right" },
      cell: ({ row }) => <span className="tabular-nums">{row.original.viewCount.toLocaleString("tr-TR")}</span>,
    },
    {
      id: "date",
      accessorFn: (r) => new Date(r.publishedAt ?? r.createdAt).getTime(),
      header: "Yayın tarihi",
      cell: ({ row }) => (
        <span className="tabular-nums text-muted-foreground">
          {formatDate(row.original.publishedAt ?? row.original.createdAt)}
        </span>
      ),
    },
  ];

  const rowActions = (post: BlogPostData): RowAction[] => [
    ...(post.status === "PUBLISHED"
      ? [{ label: "Sitede görüntüle", href: `/blog/${post.slug}`, icon: <ExternalLink aria-hidden /> }]
      : []),
    { label: "Düzenle", href: editHref(post), icon: <Pencil aria-hidden /> },
    ...(post.status !== "PUBLISHED"
      ? [{ label: "Yayınla", onSelect: () => handlePublish(post.id), icon: <CheckCircle aria-hidden /> }]
      : []),
    ...(post.status !== "ARCHIVED"
      ? [{ label: "Arşivle", onSelect: () => handleArchive(post.id), icon: <Archive aria-hidden /> }]
      : []),
    { label: "Sil", onSelect: () => handleDelete(post.id), icon: <Trash2 aria-hidden />, destructive: true, separator: true },
  ];

  return (
    <>
      <PageHeader
        title="Blog yazıları"
        description="Blog içeriklerini ve kategorilerini yönetin."
        actions={
          <>
            <button type="button" onClick={openCreateCategory} className={appButton({ variant: "outline" })}>
              <Layers aria-hidden />
              Yeni kategori
            </button>
            <Link href="/yonetim/icerik/blog/yeni" className={appButton()}>
              <Plus aria-hidden />
              Yeni yazı
            </Link>
          </>
        }
      />

      <StatGrid columns={3} className="grid-cols-1 sm:grid-cols-3">
        <StatCard label="Toplam yazı" value={total.toLocaleString("tr-TR")} icon={FileText} />
        <StatCard
          label="Yayında"
          value={publishedCount.toLocaleString("tr-TR")}
          hint="Sitede görünen yazılar"
          tone={publishedCount ? "success" : undefined}
        />
        <StatCard
          label="Taslak"
          value={draftCount.toLocaleString("tr-TR")}
          hint="Henüz yayınlanmamış"
          tone={draftCount ? "neutral" : undefined}
        />
      </StatGrid>

      <DataTable
        caption="Blog yazıları"
        columns={columns}
        data={data}
        getRowId={(p) => p.id}
        initialSort={[{ id: "date", desc: true }]}
        searchFn={(p, q) =>
          p.title.toLocaleLowerCase("tr-TR").includes(q) ||
          p.excerpt.toLocaleLowerCase("tr-TR").includes(q) ||
          p.slug.toLocaleLowerCase("tr-TR").includes(q)
        }
        searchPlaceholder="Başlık, özet veya slug ara…"
        filters={[
          { id: "status", label: "Durum", options: getStatusOptions("content"), getValue: (p) => p.status },
          {
            id: "category",
            label: "Kategori",
            variant: "select",
            allLabel: "Tüm kategoriler",
            defaultValue: initialCategory,
            options: categories.map((c) => ({ value: c.id, label: c.name })),
            getValue: (p) => p.category.id,
          },
        ]}
        rowHref={editHref}
        rowActions={rowActions}
        mobileCard={(p) => (
          <ListRow
            title={p.title}
            subtitle={`${p.category.name} · /${p.slug}`}
            meta={
              <>
                <StatusBadge kind="content" status={p.status} />
                <span className="tabular-nums">{formatDate(p.publishedAt ?? p.createdAt)}</span>
                <span className="tabular-nums">{p.viewCount.toLocaleString("tr-TR")} görüntülenme</span>
              </>
            }
          />
        )}
        emptyState={
          <EmptyState
            icon={FileText}
            title="Henüz blog yazısı yok"
            description="İlk yazınızı oluşturduğunuzda burada listelenir."
            action={
              <Link href="/yonetim/icerik/blog/yeni" className={appButton()}>
                <Plus aria-hidden />
                Yeni yazı
              </Link>
            }
          />
        }
      />

      <CategoryList
        title="Kategoriler"
        description="Blog yazılarının gruplandığı kategoriler."
        categories={categories.map((c) => ({ id: c.id, name: c.name, slug: c.slug, count: c._count.posts }))}
        countLabel="yazı"
        onEdit={(id) => {
          const cat = categories.find((c) => c.id === id);
          if (cat) openEditCategory(cat);
        }}
        onCreate={openCreateCategory}
      />

      <CategoryDialog
        open={categoryDialogOpen}
        onOpenChange={setCategoryDialogOpen}
        title={editingCategory ? "Kategoriyi düzenle" : "Yeni kategori"}
        description="Blog kategorisi bilgilerini girin."
        idPrefix="blog-cat"
        form={categoryForm}
        onChange={(patch) => setCategoryForm((prev) => ({ ...prev, ...patch }))}
        onNameChange={(name) =>
          setCategoryForm((prev) => ({
            ...prev,
            name,
            slug: editingCategory ? prev.slug : generateSlug(name),
          }))
        }
        onSubmit={handleCategorySubmit}
        onDelete={editingCategory ? () => handleDeleteCategory(editingCategory.id) : undefined}
        busy={isMutating}
      />
    </>
  );
}
