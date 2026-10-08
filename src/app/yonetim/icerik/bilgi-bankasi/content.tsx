"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Archive, BookOpen, CheckCircle, ExternalLink, Layers, Pencil, Plus, Trash2 } from "lucide-react";
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

export function KnowledgeBaseContent({
  data,
  total,
  categories: initialCategories,
  initialCategory,
}: KnowledgeBaseContentProps) {
  const router = useRouter();
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

  const editHref = (a: KbArticleData) => `/yonetim/icerik/bilgi-bankasi/${a.id}/duzenle`;

  const columns: ColumnDef<KbArticleData>[] = [
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
      accessorKey: "displayOrder",
      header: "Sıra",
      meta: { align: "right" },
      cell: ({ row }) => <span className="tabular-nums text-muted-foreground">{row.original.displayOrder}</span>,
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

  const rowActions = (a: KbArticleData): RowAction[] => [
    ...(a.status === "PUBLISHED"
      ? [
          {
            label: "Sitede görüntüle",
            href: `/bilgi-bankasi/${a.category.slug}/${a.slug}`,
            icon: <ExternalLink aria-hidden />,
          },
        ]
      : []),
    { label: "Düzenle", href: editHref(a), icon: <Pencil aria-hidden /> },
    ...(a.status !== "PUBLISHED"
      ? [{ label: "Yayınla", onSelect: () => handlePublish(a.id), icon: <CheckCircle aria-hidden /> }]
      : []),
    ...(a.status !== "ARCHIVED"
      ? [{ label: "Arşivle", onSelect: () => handleArchive(a.id), icon: <Archive aria-hidden /> }]
      : []),
    { label: "Sil", onSelect: () => handleDelete(a.id), icon: <Trash2 aria-hidden />, destructive: true, separator: true },
  ];

  return (
    <>
      <PageHeader
        title="Bilgi bankası"
        description="Yardım makalelerini ve kategorilerini yönetin."
        actions={
          <>
            <button type="button" onClick={openCreateCategory} className={appButton({ variant: "outline" })}>
              <Layers aria-hidden />
              Yeni kategori
            </button>
            <Link href="/yonetim/icerik/bilgi-bankasi/yeni" className={appButton()}>
              <Plus aria-hidden />
              Yeni makale
            </Link>
          </>
        }
      />

      <StatGrid columns={3} className="grid-cols-1 sm:grid-cols-3">
        <StatCard label="Toplam makale" value={total.toLocaleString("tr-TR")} icon={BookOpen} />
        <StatCard
          label="Yayında"
          value={publishedCount.toLocaleString("tr-TR")}
          hint="Sitede görünen makaleler"
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
        caption="Bilgi bankası makaleleri"
        columns={columns}
        data={data}
        getRowId={(a) => a.id}
        initialSort={[{ id: "date", desc: true }]}
        searchFn={(a, q) =>
          a.title.toLocaleLowerCase("tr-TR").includes(q) || a.slug.toLocaleLowerCase("tr-TR").includes(q)
        }
        searchPlaceholder="Başlık veya slug ara…"
        filters={[
          { id: "status", label: "Durum", options: getStatusOptions("content"), getValue: (a) => a.status },
          {
            id: "category",
            label: "Kategori",
            variant: "select",
            allLabel: "Tüm kategoriler",
            defaultValue: initialCategory,
            options: categories.map((c) => ({ value: c.id, label: c.name })),
            getValue: (a) => a.category.id,
          },
        ]}
        rowHref={editHref}
        rowActions={rowActions}
        mobileCard={(a) => (
          <ListRow
            title={a.title}
            subtitle={`${a.category.name} · /${a.slug}`}
            meta={
              <>
                <StatusBadge kind="content" status={a.status} />
                <span className="tabular-nums">{formatDate(a.publishedAt ?? a.createdAt)}</span>
                <span className="tabular-nums">{a.viewCount.toLocaleString("tr-TR")} görüntülenme</span>
                <span>Sıra {a.displayOrder}</span>
              </>
            }
          />
        )}
        emptyState={
          <EmptyState
            icon={BookOpen}
            title="Henüz makale yok"
            description="İlk makalenizi oluşturduğunuzda burada listelenir."
            action={
              <Link href="/yonetim/icerik/bilgi-bankasi/yeni" className={appButton()}>
                <Plus aria-hidden />
                Yeni makale
              </Link>
            }
          />
        }
      />

      <CategoryList
        title="Kategoriler"
        description="Makalelerin gruplandığı kategoriler; sıralamaya göre gösterilir."
        categories={categories.map((c) => ({ id: c.id, name: c.name, slug: c.slug, count: c._count.articles }))}
        countLabel="makale"
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
        description="Bilgi bankası kategorisi bilgilerini girin."
        idPrefix="kb-cat"
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
