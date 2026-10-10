"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckCircle, Clock, Link2, Lock, Mail, RotateCcw, Send, UserCheck } from "lucide-react";
import {
  AppBreadcrumbLabel,
  DetailList,
  PageHeader,
  SectionCard,
  StatusBadge,
  ToneDot,
  appButton,
  enumLabel,
  getStatusMeta,
} from "@/components/app";
import { CannedReplyTextarea } from "@/components/admin/support/canned-reply-textarea";
import { TicketPresenceNotice, useTicketPresence } from "@/components/admin/support/ticket-presence";
import {
  assignTicket,
  closeTicket,
  linkTicketToCustomer,
  reopenTicket,
  setTicketStatus,
} from "@/lib/actions/admin/tickets";
import { markCannedReplyUsed } from "@/lib/actions/admin/support-canned";
import { renderCannedReply } from "@/lib/support/canned";
import type { ThreadMessage } from "@/lib/support/serialize";
import { AttachmentPicker, MessageAttachments, SelectedFiles, postTicketForm } from "@/components/support/attachments";
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
  source: string;
  assignedTo: string | null;
  relatedServiceId: string | null;
  createdAt: string;
  updatedAt: string;
  closedAt: string | null;
  waitingSince: string | null;
  customer: { id: string; name: string; surname: string; email: string; phone: string | null } | null;
  /** E-mail ticket from an address without a verified customer account. */
  guest: { email: string; name: string | null } | null;
  messages: ThreadMessage[];
}

type CannedReplyOption = { id: string; title: string; body: string };

interface TicketDetailContentProps {
  ticket: AdminTicketDetail;
  adminUsers: { id: string; name: string; surname: string; email: string }[];
  cannedReplies: CannedReplyOption[];
  staffName: string;
}

const REPLY_STATUS_OPTIONS = [
  { value: "ADMIN_REPLY", label: "Yanıtlandı" },
  { value: "WAITING", label: "Müşteri yanıtı bekleniyor" },
  { value: "CLOSED", label: "Yanıtla ve kapat" },
] as const;

const selectClass =
  "h-11 w-full rounded-md border bg-background px-2.5 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:h-9";

export function TicketDetailContent({ ticket, adminUsers, cannedReplies, staffName }: TicketDetailContentProps) {
  const router = useRouter();
  const [replyText, setReplyText] = useState("");
  const [replyStatus, setReplyStatus] = useState<string>("ADMIN_REPLY");
  const [files, setFiles] = useState<File[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isAssigning, setIsAssigning] = useState(false);
  const [assignedAdminId, setAssignedAdminId] = useState(ticket.assignedTo ?? "");
  const [linkEmail, setLinkEmail] = useState(ticket.guest?.email ?? "");
  // Bumped on every keystroke in the reply box → "yanıt yazıyor" for other staff.
  const [typingSignal, setTypingSignal] = useState(0);
  const viewers = useTicketPresence(ticket.id, typingSignal);

  const customerFullName = ticket.customer
    ? `${ticket.customer.name} ${ticket.customer.surname}`.trim()
    : ticket.guest?.name || ticket.guest?.email || "Bilinmeyen gönderen";
  const customerEmail = ticket.customer?.email ?? ticket.guest?.email ?? "";

  const renderReply = (reply: CannedReplyOption) =>
    renderCannedReply(reply.body, {
      "customer.name": customerFullName,
      "customer.firstName": ticket.customer?.name ?? ticket.guest?.name?.split(" ")[0] ?? "",
      "customer.email": customerEmail,
      "ticket.number": ticket.ticketNumber,
      "ticket.subject": ticket.subject,
      "staff.name": staffName,
    });

  const insertCannedReply = (id: string) => {
    const reply = cannedReplies.find((r) => r.id === id);
    if (!reply) return;
    const text = renderReply(reply);
    setReplyText((current) => (current.trim() ? `${current.trimEnd()}\n\n${text}` : text));
    void markCannedReplyUsed(id);
  };

  const handleWaiting = async () => {
    const result = await setTicketStatus(ticket.id, "WAITING");
    if (!result.success) {
      toast.error(result.error ?? "Durum değiştirilemedi");
      return;
    }
    toast.success("Talep müşteri yanıtı bekleniyor olarak işaretlendi");
    router.refresh();
  };

  const handleLink = async () => {
    const result = await linkTicketToCustomer(ticket.id, linkEmail);
    if (!result.success) {
      toast.error(result.error ?? "Talep bağlanamadı");
      return;
    }
    toast.success("Talep müşteri hesabına bağlandı");
    router.refresh();
  };
  const isClosed = ticket.status === "CLOSED";
  const priority = getStatusMeta("ticketPriority", ticket.priority);
  const assignee = adminUsers.find((a) => a.id === ticket.assignedTo);

  const handleReply = async () => {
    if (!replyText.trim() || isSubmitting) return;
    setIsSubmitting(true);
    const form = new FormData();
    form.set("message", replyText);
    form.set("status", replyStatus);
    for (const file of files) form.append("files", file);
    const result = await postTicketForm(`/api/admin/support/tickets/${ticket.id}/messages`, form);
    if (result.success) {
      setReplyText("");
      setFiles([]);
      setReplyStatus("ADMIN_REPLY");
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
            <>
              {ticket.status !== "WAITING" ? (
                <button type="button" className={appButton({ variant: "outline" })} onClick={() => void handleWaiting()}>
                  <Clock aria-hidden />
                  Müşteri yanıtı bekleniyor
                </button>
              ) : null}
              <button type="button" className={appButton({ variant: "outline" })} onClick={() => void handleClose()}>
                <CheckCircle aria-hidden />
                Talebi kapat
              </button>
            </>
          )
        }
      />

      <TicketPresenceNotice viewers={viewers} />

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
                            {message.source === "EMAIL" ? (
                              <span className="ml-2 inline-flex items-center gap-1 text-xs font-normal text-muted-foreground">
                                <Mail aria-hidden className="size-3" />
                                e-posta
                              </span>
                            ) : null}
                          </p>
                          <time dateTime={message.createdAt} className="font-mono text-[11px] text-muted-foreground">
                            {formatDateTime(message.createdAt)}
                          </time>
                        </div>
                        <div className="whitespace-pre-wrap break-words text-sm leading-relaxed">{message.message}</div>
                        <MessageAttachments files={message.files} legacy={message.legacyAttachments} />
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
                  <div className="mr-auto flex flex-wrap items-center gap-2">
                    <AttachmentPicker compact files={files} onChange={setFiles} id="reply-files" disabled={isSubmitting} />
                    <label htmlFor="reply-status" className="sr-only">
                      Yanıttan sonraki durum
                    </label>
                    <select
                      id="reply-status"
                      value={replyStatus}
                      onChange={(e) => setReplyStatus(e.target.value)}
                      className={selectClass + " w-auto"}
                    >
                      {REPLY_STATUS_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </div>
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
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <label htmlFor="canned-reply" className="sr-only">
                  Hazır yanıt ekle
                </label>
                <select
                  id="canned-reply"
                  value=""
                  onChange={(e) => insertCannedReply(e.target.value)}
                  className={selectClass + " sm:w-72"}
                  disabled={cannedReplies.length === 0}
                >
                  <option value="">{cannedReplies.length ? "Hazır yanıt ekle…" : "Hazır yanıt yok"}</option>
                  {cannedReplies.map((reply) => (
                    <option key={reply.id} value={reply.id}>
                      {reply.title}
                    </option>
                  ))}
                </select>
                <Link href="/yonetim/destek/hazir-yanitlar" className={appButton({ variant: "ghost", size: "sm" })}>
                  Yönet
                </Link>
              </div>
              <label htmlFor="reply" className="sr-only">
                Yanıtınız
              </label>
              <CannedReplyTextarea
                id="reply"
                placeholder="Yanıtınızı yazın… Hazır yanıt için / yazın"
                value={replyText}
                onChange={(text) => {
                  setReplyText(text);
                  setTypingSignal((n) => n + 1);
                }}
                replies={cannedReplies}
                render={renderReply}
                onInserted={(reply) => void markCannedReplyUsed(reply.id)}
                disabled={isSubmitting}
              />
              <SelectedFiles files={files} onChange={setFiles} />
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
                { label: "Kaynak", value: ticket.source === "EMAIL" ? "E-posta" : ticket.source === "API" ? "API" : "Panel" },
                {
                  label: "Müşteri yanıtı bekleniyor",
                  value: ticket.waitingSince ? `${formatDateTime(ticket.waitingSince)} itibarıyla` : null,
                },
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
              className={selectClass}
            >
              <option value="">Personel seçin</option>
              {adminUsers.map((admin) => (
                <option key={admin.id} value={admin.id}>
                  {`${admin.name} ${admin.surname}`.trim()} ({admin.email})
                </option>
              ))}
            </select>
          </SectionCard>

          {ticket.customer ? (
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
          ) : (
            <SectionCard
              title="Gönderen (kayıtsız)"
              description="E-posta adresi doğrulanmış bir müşteri hesabıyla eşleşmedi. Yanıtlar bu adrese e-posta ile gider."
              footer={
                <button
                  type="button"
                  className={appButton({ variant: "outline", size: "sm" })}
                  onClick={() => void handleLink()}
                  disabled={!linkEmail.trim()}
                >
                  <Link2 aria-hidden />
                  Müşteriye bağla
                </button>
              }
            >
              <DetailList
                items={[
                  { label: "Ad", value: ticket.guest?.name ?? null },
                  { label: "E-posta", value: ticket.guest?.email ?? "", copy: ticket.guest?.email ?? undefined },
                ]}
              />
              <label htmlFor="link-email" className="mb-1.5 mt-4 block text-sm font-medium">
                Müşteri hesabının e-postası
              </label>
              <input
                id="link-email"
                type="email"
                value={linkEmail}
                onChange={(e) => setLinkEmail(e.target.value)}
                className={selectClass}
              />
            </SectionCard>
          )}
        </div>
      </div>
    </>
  );
}
