"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckCircle, Lock, Paperclip, RotateCcw, Send, UserCheck } from "lucide-react";
import {
  AppBreadcrumbLabel,
  DetailList,
  PageHeader,
  SectionCard,
  StatusBadge,
  ToneDot,
  UnavailableAction,
  appButton,
  enumLabel,
  getStatusMeta,
} from "@/components/app";
import { Textarea } from "@/components/ui/textarea";
import { assignTicket, closeTicket, reopenTicket, replyToTicket } from "@/lib/actions/admin/tickets";
import { formatDateTime } from "@/lib/format/date";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";

export interface AdminTicketDetail {
  id: string;
  ticketNumber: string;
  subject: string;
  department: string;
  priority: string;
  status: string;
  assignedTo: string | null;
  relatedServiceId: string | null;
  createdAt: string;
  updatedAt: string;
  closedAt: string | null;
  customer: { id: string; name: string; surname: string; email: string; phone: string | null };
  messages: { id: string; senderName: string; senderRole: string; message: string; createdAt: string }[];
}

interface TicketDetailContentProps {
  ticket: AdminTicketDetail;
  adminUsers: { id: string; name: string; surname: string; email: string }[];
}

const quickReplies = [
  "Talebiniz için teşekkürler. İnceliyorum.",
  "DNS propagasyonu 24-48 saat sürebilir.",
  "Lütfen tarayıcı önbelleğinizi temizleyin.",
  "Sorununuz çözüldü mü?",
];

export function TicketDetailContent({ ticket, adminUsers }: TicketDetailContentProps) {
  const router = useRouter();
  const [replyText, setReplyText] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isAssigning, setIsAssigning] = useState(false);
  const [assignedAdminId, setAssignedAdminId] = useState(ticket.assignedTo ?? "");

  const customerFullName = `${ticket.customer.name} ${ticket.customer.surname}`.trim();
  const isClosed = ticket.status === "CLOSED";
  const priority = getStatusMeta("ticketPriority", ticket.priority);
  const assignee = adminUsers.find((a) => a.id === ticket.assignedTo);

  const handleReply = async () => {
    if (!replyText.trim() || isSubmitting) return;
    setIsSubmitting(true);
    const result = await replyToTicket(ticket.id, replyText);
    if (result.success) {
      setReplyText("");
      toast.success("Yanıt gönderildi");
      router.refresh();
    } else {
      toast.error(result.error ?? "Yanıt gönderilemedi");
    }
    setIsSubmitting(false);
  };

  const handleClose = async () => {
    const result = await closeTicket(ticket.id);
    if (!result.success) {
      toast.error(result.error ?? "Talep kapatılamadı");
      return;
    }
    toast.success("Talep kapatıldı");
    router.refresh();
  };

  const handleReopen = async () => {
    const result = await reopenTicket(ticket.id);
    if (!result.success) {
      toast.error(result.error ?? "Talep yeniden açılamadı");
      return;
    }
    toast.success("Talep yeniden açıldı");
    router.refresh();
  };

  const handleAssign = async () => {
    if (!assignedAdminId) {
      toast.error("Lütfen atanacak personeli seçin");
      return;
    }
    if (assignedAdminId === ticket.assignedTo) {
      toast.info("Talep zaten seçili personele atanmış");
      return;
    }
    setIsAssigning(true);
    const result = await assignTicket(ticket.id, assignedAdminId);
    if (!result.success) {
      toast.error(result.error ?? "Talep atanamadı");
      setIsAssigning(false);
      return;
    }
    toast.success("Talep personele atandı");
    setIsAssigning(false);
    router.refresh();
  };

  return (
    <>
      <AppBreadcrumbLabel segment={ticket.id} label={`#${ticket.ticketNumber}`} />

      <PageHeader
        back={{ href: "/yonetim/destek", label: "Destek talepleri" }}
        eyebrow={<span className="normal-case tracking-normal">#{ticket.ticketNumber}</span>}
        title={ticket.subject}
        meta={
          <>
            <StatusBadge kind="ticket" audience="admin" status={ticket.status} size="md" />
            <span className="inline-flex items-center gap-1.5">
              <ToneDot tone={priority.tone} />
              {priority.label} öncelik
            </span>
            <span>{enumLabel("ticketDepartment", ticket.department)}</span>
            <span>Açılış {formatDateTime(ticket.createdAt)}</span>
          </>
        }
        actions={
          isClosed ? (
            <button type="button" className={appButton({ variant: "outline" })} onClick={() => void handleReopen()}>
              <RotateCcw aria-hidden />
              Yeniden aç
            </button>
          ) : (
            <button type="button" className={appButton({ variant: "outline" })} onClick={() => void handleClose()}>
              <CheckCircle aria-hidden />
              Talebi kapat
            </button>
          )
        }
      />

      <div className="grid items-start gap-6 lg:grid-cols-3">
        <div className="min-w-0 space-y-6 lg:col-span-2">
          <SectionCard title={`Mesajlar (${ticket.messages.length})`}>
            {ticket.messages.length === 0 ? (
              <p className="text-sm text-muted-foreground">Bu talepte henüz mesaj yok.</p>
            ) : (
              <ol className="relative space-y-5">
                <span aria-hidden className="line-dashed-y absolute bottom-2 left-4 top-2" />
                {ticket.messages.map((message) => {
                  const isStaff = message.senderRole !== "CUSTOMER";
                  const initial = message.senderName.trim().charAt(0).toLocaleUpperCase("tr-TR") || "?";
                  return (
                    <li key={message.id} className="relative flex gap-3">
                      <span
                        aria-hidden
                        className={cn(
                          "relative z-10 flex size-8 shrink-0 items-center justify-center rounded-md border text-xs font-semibold",
                          isStaff ? "bg-foreground text-background" : "bg-background"
                        )}
                      >
                        {initial}
                      </span>
                      <div className={cn("min-w-0 flex-1 rounded-lg border p-3.5 md:p-4", isStaff ? "bg-muted/40" : "bg-card")}>
                        <div className="mb-2 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                          <p className="text-sm font-medium">
                            {message.senderName}
                            <span className="ml-2 rounded border px-1.5 py-0.5 font-mono text-[10px] font-normal uppercase tracking-wider text-muted-foreground">
                              {isStaff ? "Personel" : "Müşteri"}
                            </span>
                          </p>
                          <time dateTime={message.createdAt} className="font-mono text-[11px] text-muted-foreground">
                            {formatDateTime(message.createdAt)}
                          </time>
                        </div>
                        <div className="whitespace-pre-wrap break-words text-sm leading-relaxed">{message.message}</div>
                      </div>
                    </li>
                  );
                })}
              </ol>
            )}
          </SectionCard>

          {!isClosed ? (
            <SectionCard
              title="Yanıt yaz"
              description="Yanıt müşteriye e-posta ile de bildirilir."
              footer={
                <>
                  <UnavailableAction label="Dosya ekle" size="sm" icon={<Paperclip aria-hidden />} className="mr-auto" />
                  <button
                    type="button"
                    className={appButton()}
                    onClick={() => void handleReply()}
                    disabled={isSubmitting || !replyText.trim()}
                  >
                    <Send aria-hidden />
                    {isSubmitting ? "Gönderiliyor…" : "Yanıtla"}
                  </button>
                </>
              }
            >
              <div className="mb-3 flex flex-wrap gap-2" aria-label="Hazır yanıtlar" role="group">
                {quickReplies.map((reply) => (
                  <button
                    key={reply}
                    type="button"
                    onClick={() => setReplyText(reply)}
                    className="min-h-9 rounded-md border border-dashed px-2.5 py-1.5 text-left text-xs text-muted-foreground transition-colors hover:border-solid hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {reply}
                  </button>
                ))}
              </div>
              <label htmlFor="reply" className="sr-only">
                Yanıtınız
              </label>
              <Textarea
                id="reply"
                placeholder="Yanıtınızı yazın…"
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                rows={6}
                className="resize-y"
              />
            </SectionCard>
          ) : (
            <div className="flex flex-col gap-3 rounded-lg border border-dashed p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3 text-sm">
                <Lock aria-hidden className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                <div>
                  <p className="font-medium">Bu talep kapatıldı</p>
                  <p className="text-muted-foreground">Yanıt yazmak için talebi yeniden açın.</p>
                </div>
              </div>
              <button type="button" className={appButton({ variant: "outline" })} onClick={() => void handleReopen()}>
                <RotateCcw aria-hidden />
                Yeniden aç
              </button>
            </div>
          )}
        </div>

        <div className="space-y-6">
          <SectionCard title="Talep bilgileri">
            <DetailList
              items={[
                { label: "Talep no", value: `#${ticket.ticketNumber}`, mono: true },
                { label: "Departman", value: enumLabel("ticketDepartment", ticket.department) },
                { label: "Öncelik", value: priority.label },
                { label: "Durum", value: <StatusBadge kind="ticket" audience="admin" status={ticket.status} /> },
                { label: "Atanan", value: assignee ? `${assignee.name} ${assignee.surname}`.trim() : "Atanmadı" },
                { label: "Açılış", value: formatDateTime(ticket.createdAt) },
                { label: "Son güncelleme", value: formatDateTime(ticket.updatedAt) },
                { label: "Kapanış", value: ticket.closedAt ? formatDateTime(ticket.closedAt) : null },
              ]}
            />
            {ticket.relatedServiceId ? (
              <div className="mt-4 border-t pt-4">
                <Link
                  href={`/yonetim/hizmetler/${ticket.relatedServiceId}`}
                  className={appButton({ variant: "outline", className: "w-full justify-start" })}
                >
                  İlgili hizmeti görüntüle
                </Link>
              </div>
            ) : null}
          </SectionCard>

          <SectionCard
            title="Personel ataması"
            footer={
              <button
                type="button"
                className={appButton({ variant: "outline", size: "sm" })}
                onClick={() => void handleAssign()}
                disabled={isAssigning || !assignedAdminId}
              >
                <UserCheck aria-hidden />
                {isAssigning ? "Atanıyor…" : "Ata"}
              </button>
            }
          >
            <label htmlFor="assignee" className="mb-1.5 block text-sm font-medium">
              Atanan personel
            </label>
            <select
              id="assignee"
              value={assignedAdminId}
              onChange={(e) => setAssignedAdminId(e.target.value)}
              className="h-11 w-full rounded-md border bg-background px-2.5 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:h-9"
            >
              <option value="">Personel seçin</option>
              {adminUsers.map((admin) => (
                <option key={admin.id} value={admin.id}>
                  {`${admin.name} ${admin.surname}`.trim()} ({admin.email})
                </option>
              ))}
            </select>
          </SectionCard>

          <SectionCard
            title="Müşteri"
            footer={
              <Link href={`/yonetim/musteriler/${ticket.customer.id}`} className={appButton({ variant: "outline", size: "sm" })}>
                Müşteri kartını aç
              </Link>
            }
          >
            <DetailList
              items={[
                { label: "Ad soyad", value: customerFullName },
                { label: "E-posta", value: ticket.customer.email, copy: ticket.customer.email },
                { label: "Telefon", value: ticket.customer.phone },
              ]}
            />
          </SectionCard>
        </div>
      </div>
    </>
  );
}
