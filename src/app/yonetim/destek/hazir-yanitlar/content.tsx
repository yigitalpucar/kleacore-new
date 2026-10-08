"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MessageSquareText, Pencil, Plus, Save, Trash2, X } from "lucide-react";
import { EmptyState, FormField, PageHeader, SectionCard, appButton, enumLabel } from "@/components/app";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { createCannedReply, deleteCannedReply, updateCannedReply } from "@/lib/actions/admin/support-canned";
import { CANNED_REPLY_VARIABLES } from "@/lib/support/canned";
import { formatDateTime } from "@/lib/format/date";
import { toast } from "@/lib/toast";

type Department = "GENERAL" | "TECHNICAL" | "BILLING" | "SALES";

interface CannedReplyRow {
  id: string;
  title: string;
  body: string;
  department: Department | null;
  usageCount: number;
  updatedAt: string;
}

const DEPARTMENTS: Department[] = ["GENERAL", "TECHNICAL", "BILLING", "SALES"];
const selectClass =
  "h-11 w-full rounded-md border bg-background px-2.5 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:h-9";

const EMPTY = { title: "", body: "", department: "" as Department | "" };

export function CannedRepliesContent({ replies }: { replies: CannedReplyRow[] }) {
  const router = useRouter();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);

  const startEdit = (reply: CannedReplyRow) => {
    setEditingId(reply.id);
    setForm({ title: reply.title, body: reply.body, department: reply.department ?? "" });
    document.getElementById("canned-form")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const reset = () => {
    setEditingId(null);
    setForm(EMPTY);
  };

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    const input = { title: form.title, body: form.body, department: form.department || null };
    const result = editingId ? await updateCannedReply(editingId, input) : await createCannedReply(input);
    setSaving(false);
    if (!result.success) {
      toast.error(result.error);
      return;
    }
    toast.success(editingId ? "Hazır yanıt güncellendi" : "Hazır yanıt eklendi");
    reset();
    router.refresh();
  };

  const remove = async (reply: CannedReplyRow) => {
    if (!window.confirm(`"${reply.title}" silinsin mi?`)) return;
    await deleteCannedReply(reply.id);
    toast.success("Hazır yanıt silindi");
    if (editingId === reply.id) reset();
    router.refresh();
  };

  const insertVariable = (key: string) => setForm((f) => ({ ...f, body: `${f.body}{{${key}}}` }));

  return (
    <>
      <PageHeader
        back={{ href: "/yonetim/destek", label: "Destek talepleri" }}
        title="Hazır yanıtlar"
        description="Sık kullanılan yanıtları kaydedin; talep ekranında tek tıkla yanıt kutusuna eklenir."
      />

      <form id="canned-form" onSubmit={save}>
        <SectionCard
          title={editingId ? "Hazır yanıtı düzenle" : "Yeni hazır yanıt"}
          bodyClassName="space-y-4"
          footer={
            <>
              {editingId ? (
                <button type="button" className={appButton({ variant: "ghost", className: "mr-auto" })} onClick={reset}>
                  <X aria-hidden />
                  Vazgeç
                </button>
              ) : null}
              <button type="submit" className={appButton()} disabled={saving || !form.title.trim() || !form.body.trim()}>
                {editingId ? <Save aria-hidden /> : <Plus aria-hidden />}
                {saving ? "Kaydediliyor…" : editingId ? "Kaydet" : "Ekle"}
              </button>
            </>
          }
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Başlık" htmlFor="canned-title" required>
              <Input
                id="canned-title"
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                maxLength={120}
                className="h-11 md:h-10"
              />
            </FormField>
            <FormField label="Departman" htmlFor="canned-department" hint="Boş bırakılırsa tüm departmanlarda görünür">
              <select
                id="canned-department"
                value={form.department}
                onChange={(e) => setForm((f) => ({ ...f, department: e.target.value as Department | "" }))}
                className={selectClass}
              >
                <option value="">Tüm departmanlar</option>
                {DEPARTMENTS.map((d) => (
                  <option key={d} value={d}>
                    {enumLabel("ticketDepartment", d)}
                  </option>
                ))}
              </select>
            </FormField>
          </div>
          <FormField label="Yanıt metni" htmlFor="canned-body" required>
            <Textarea
              id="canned-body"
              value={form.body}
              onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))}
              rows={6}
              className="resize-y"
            />
          </FormField>
          <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Değişken ekle">
            <span className="text-xs text-muted-foreground">Değişkenler:</span>
            {CANNED_REPLY_VARIABLES.map((v) => (
              <button
                key={v.key}
                type="button"
                title={v.label}
                onClick={() => insertVariable(v.key)}
                className="min-h-9 rounded-md border border-dashed px-2 py-1 font-mono text-xs text-muted-foreground transition-colors hover:border-solid hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {`{{${v.key}}}`}
              </button>
            ))}
          </div>
        </SectionCard>
      </form>

      <SectionCard title={`Kayıtlı yanıtlar (${replies.length})`} flush>
        {replies.length === 0 ? (
          <div className="p-4">
            <EmptyState icon={MessageSquareText} title="Henüz hazır yanıt yok" description="Yukarıdaki formdan ilk yanıtınızı ekleyin." compact />
          </div>
        ) : (
          <ul className="divide-y">
            {replies.map((reply) => (
              <li key={reply.id} className="flex flex-col gap-2 p-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <p className="font-medium">{reply.title}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {reply.department ? enumLabel("ticketDepartment", reply.department) : "Tüm departmanlar"} ·{" "}
                    {reply.usageCount} kullanım · {formatDateTime(reply.updatedAt)}
                  </p>
                  <p className="mt-2 line-clamp-3 whitespace-pre-wrap break-words text-sm text-muted-foreground">{reply.body}</p>
                </div>
                <div className="flex shrink-0 gap-2">
                  <button type="button" className={appButton({ variant: "outline", size: "sm" })} onClick={() => startEdit(reply)}>
                    <Pencil aria-hidden />
                    Düzenle
                  </button>
                  <button
                    type="button"
                    aria-label={`${reply.title} yanıtını sil`}
                    className={appButton({ variant: "ghost", size: "icon-sm" })}
                    onClick={() => void remove(reply)}
                  >
                    <Trash2 aria-hidden />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>
    </>
  );
}
