"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Textarea } from "@/components/ui/textarea";
import { FileText, Image as ImageIcon, Lock, MessageSquare, Paperclip, Send, Star, XCircle } from "lucide-react";
import {
  AppBreadcrumbLabel,
  DetailList,
  PageHeader,
  RowActionsMenu,
  SectionCard,
  StatusBadge,
  ToneDot,
  UnavailableAction,
  appButton,
  enumLabel,
  getStatusMeta,
} from "@/components/app";
import { cn } from "@/lib/utils";
import { formatDateTime } from "@/lib/format/date";
import {
  closeTicket,
  reopenTicket,
  replyToTicket,
} from "@/lib/actions/customer/tickets";
import { toast } from "@/lib/toast";

interface TicketAttachment {
  name: string;
  size: string;
  type: "image" | "document";
}

interface TicketMessage {
  id: string;
  senderId: string;
  senderName: string;
  senderRole: string;
  message: string;
  attachments: TicketAttachment[];
  createdAt: string;
}

interface TicketDetail {
  id: string;
  ticketNumber: string;
  subject: string;
  department: string;
  priority: string;
  status: string;
  relatedServiceId: string | null;
  createdAt: string;
  updatedAt: string;
  closedAt: string | null;
  customer: {
    id: string;
    name: string;
    surname: string;
    email: string;
    phone: string | null;
  };
  messages: TicketMessage[];
}

interface DestekDetayContentProps {
  ticket: TicketDetail;
}

export function DestekDetayContent({ ticket }: DestekDetayContentProps) {
  const router = useRouter();
  const [replyText, setReplyText] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!replyText.trim() || isSubmitting) return;

    setIsSubmitting(true);
    const result = await replyToTicket(ticket.id, replyText.trim());
    setIsSubmitting(false);

    if (result.success) {
      setReplyText("");
      toast.success("Yanıtınız gönderildi");
      router.refresh();
    } else {
      toast.error(result.error ?? "Yanıt gönderilemedi");
    }
  };

  const handleCloseTicket = async () => {
    const result = await closeTicket(ticket.id);
    if (!result.success) {
      toast.error(result.error ?? "Talep kapatılamadı");
      return;
    }

    toast.success("Talep kapatıldı");
    router.refresh();
  };

  const handleReopenTicket = async () => {
    const result = await reopenTicket(ticket.id);
    if (!result.success) {
      toast.error(result.error ?? "Talep yeniden açılamadı");
      return;
    }

    toast.success("Talep yeniden açıldı");
    router.refresh();
  };

  const isClosed = ticket.status === "CLOSED";
  const priority = getStatusMeta("ticketPriority", ticket.priority);

  return (
    <>
      <AppBreadcrumbLabel segment={ticket.id} label={`#${ticket.ticketNumber}`} />

      <PageHeader
        back={{ href: "/musteri/panel/destek", label: "Destek talepleri" }}
        eyebrow={<span className="normal-case tracking-normal">#{ticket.ticketNumber}</span>}
        title={ticket.subject}
        meta={
          <>
            <StatusBadge kind="ticket" status={ticket.status} size="md" />
            <span className="inline-flex items-center gap-1.5">
              <ToneDot tone={priority.tone} />
              {priority.label} öncelik
            </span>
            <span>{enumLabel("ticketDepartment", ticket.department)}</span>
            <span>Açılış {formatDateTime(ticket.createdAt)}</span>
          </>
        }
        actions={
          <RowActionsMenu
            label="Talep işlemleri"
            actions={[
              { label: "Öncelik değiştir", icon: <Star aria-hidden />, disabledReason: "Yakında" },
              isClosed
                ? { label: "Talebi yeniden aç", icon: <MessageSquare aria-hidden />, onSelect: () => void handleReopenTicket(), separator: true }
                : { label: "Talebi kapat", icon: <XCircle aria-hidden />, onSelect: () => void handleCloseTicket(), destructive: true, separator: true },
            ]}
          />
        }
      />

      <div className="grid items-start gap-6 lg:grid-cols-3">
        <div className="min-w-0 space-y-6 lg:col-span-2">
          <SectionCard title={`Mesajlar (${ticket.messages.length})`}>
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
                    <div
                      className={cn(
                        "min-w-0 flex-1 rounded-lg border p-3.5 md:p-4",
                        isStaff ? "bg-muted/40" : "bg-card"
                      )}
                    >
                      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                        <p className="text-sm font-medium">
                          {message.senderName}
                          {isStaff ? (
                            <span className="ml-2 rounded border px-1.5 py-0.5 font-mono text-[10px] font-normal uppercase tracking-wider text-muted-foreground">
                              Destek ekibi
                            </span>
                          ) : null}
                        </p>
                        <time dateTime={message.createdAt} className="font-mono text-[11px] text-muted-foreground">
                          {formatDateTime(message.createdAt)}
                        </time>
                      </div>
                      <div className="whitespace-pre-wrap break-words text-sm leading-relaxed">{message.message}</div>
                      {message.attachments && message.attachments.length > 0 ? (
                        <div className="mt-3 border-t border-dashed pt-3">
                          <p className="mb-2 text-xs text-muted-foreground">Ekler (yalnızca dosya adları)</p>
                          <ul className="flex flex-wrap gap-2">
                            {message.attachments.map((attachment, index) => (
                              <li
                                key={index}
                                className="flex items-center gap-2 rounded-md border bg-background px-2.5 py-1.5"
                              >
                                {attachment.type === "image" ? (
                                  <ImageIcon aria-hidden className="size-4 text-muted-foreground" />
                                ) : (
                                  <FileText aria-hidden className="size-4 text-muted-foreground" />
                                )}
                                <span className="text-[13px] font-medium">{attachment.name}</span>
                                <span className="text-xs text-muted-foreground">{attachment.size}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ol>
          </SectionCard>

          {!isClosed ? (
            <SectionCard
              title="Yanıt yaz"
              footer={
                <>
                  <UnavailableAction label="Dosya ekle" size="sm" icon={<Paperclip aria-hidden />} className="mr-auto" />
                  <button
                    type="button"
                    className={appButton()}
                    onClick={handleSubmit}
                    disabled={!replyText.trim() || isSubmitting}
                  >
                    <Send aria-hidden />
                    {isSubmitting ? "Gönderiliyor…" : "Gönder"}
                  </button>
                </>
              }
            >
              <label htmlFor="reply" className="sr-only">
                Yanıtınız
              </label>
              <Textarea
                id="reply"
                placeholder="Mesajınızı yazın…"
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                rows={5}
                className="resize-y"
              />
            </SectionCard>
          ) : (
            <div className="flex flex-col gap-3 rounded-lg border border-dashed p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3 text-sm">
                <Lock aria-hidden className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                <div>
                  <p className="font-medium">Bu talep kapatıldı</p>
                  <p className="text-muted-foreground">Yeni mesaj göndermek için talebi yeniden açabilirsiniz.</p>
                </div>
              </div>
              <button type="button" className={appButton({ variant: "outline" })} onClick={() => void handleReopenTicket()}>
                <MessageSquare aria-hidden />
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
                { label: "Durum", value: <StatusBadge kind="ticket" status={ticket.status} /> },
                { label: "Açılış", value: formatDateTime(ticket.createdAt) },
                { label: "Son güncelleme", value: formatDateTime(ticket.updatedAt) },
                { label: "Kapanış", value: ticket.closedAt ? formatDateTime(ticket.closedAt) : null },
              ]}
            />
            {ticket.relatedServiceId ? (
              <div className="mt-4 border-t pt-4">
                <Link
                  href={`/musteri/panel/hizmetlerim/${ticket.relatedServiceId}`}
                  className={appButton({ variant: "outline", className: "w-full justify-start" })}
                >
                  İlgili hizmeti görüntüle
                </Link>
              </div>
            ) : null}
          </SectionCard>

          <SectionCard title="İşlemler">
            <div className="grid gap-2">
              <UnavailableAction label="Önceliği yükselt" icon={<Star aria-hidden />} className="justify-start" />
              {!isClosed ? (
                <button
                  type="button"
                  className={appButton({ variant: "destructive", className: "justify-start" })}
                  onClick={() => void handleCloseTicket()}
                >
                  <XCircle aria-hidden />
                  Talebi kapat
                </button>
              ) : (
                <button
                  type="button"
                  className={appButton({ variant: "outline", className: "justify-start" })}
                  onClick={() => void handleReopenTicket()}
                >
                  <MessageSquare aria-hidden />
                  Yeniden aç
                </button>
              )}
            </div>
          </SectionCard>
        </div>
      </div>
    </>
  );
}
