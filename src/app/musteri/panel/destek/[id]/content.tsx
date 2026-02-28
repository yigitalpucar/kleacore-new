"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BlurFade } from "@/components/magicui/blur-fade";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Headphones,
  ArrowLeft,
  MessageSquare,
  CheckCircle2,
  Clock,
  AlertCircle,
  Send,
  Paperclip,
  User,
  Calendar,
  Tag,
  Building,
  XCircle,
  Lock,
  MoreVertical,
  AlertTriangle,
  Star,
  Download,
  FileText,
  Image as ImageIcon,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
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

const statusConfig: Record<
  string,
  { label: string; color: string; bgColor: string; icon: typeof MessageSquare }
> = {
  OPEN: {
    label: "Açık",
    color: "text-blue-500",
    bgColor: "bg-blue-500/10",
    icon: MessageSquare,
  },
  CUSTOMER_REPLY: {
    label: "Yanıt Bekliyor",
    color: "text-orange-500",
    bgColor: "bg-orange-500/10",
    icon: Clock,
  },
  ADMIN_REPLY: {
    label: "Yanıtlandı",
    color: "text-green-500",
    bgColor: "bg-green-500/10",
    icon: CheckCircle2,
  },
  WAITING: {
    label: "Beklemede",
    color: "text-orange-500",
    bgColor: "bg-orange-500/10",
    icon: Clock,
  },
  CLOSED: {
    label: "Kapalı",
    color: "text-gray-500",
    bgColor: "bg-gray-500/10",
    icon: Lock,
  },
};

const priorityConfig: Record<
  string,
  { label: string; color: string; bgColor: string }
> = {
  LOW: { label: "Düşük", color: "text-gray-500", bgColor: "bg-gray-500/10" },
  MEDIUM: { label: "Normal", color: "text-blue-500", bgColor: "bg-blue-500/10" },
  HIGH: { label: "Yüksek", color: "text-red-500", bgColor: "bg-red-500/10" },
  URGENT: { label: "Acil", color: "text-red-700", bgColor: "bg-red-700/10" },
};

const departmentLabels: Record<string, string> = {
  GENERAL: "Genel",
  TECHNICAL: "Teknik Destek",
  BILLING: "Muhasebe",
  SALES: "Satış",
};

export function DestekDetayContent({ ticket }: DestekDetayContentProps) {
  const router = useRouter();
  const [replyText, setReplyText] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const status = statusConfig[ticket.status] || statusConfig.OPEN;
  const priority = priorityConfig[ticket.priority] || priorityConfig.MEDIUM;
  const StatusIcon = status.icon;

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

  return (
    <div className="space-y-6">
      {/* Back Button & Header */}
      <BlurFade delay={0.1} inView>
        <div className="flex flex-col gap-4">
          <Link
            href="/musteri/panel/destek"
            className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground transition-colors w-fit"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Taleplere Dön
          </Link>

          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            <div className="flex items-start gap-4">
              <div className={cn("p-4 rounded-xl", status.bgColor)}>
                <Headphones className={cn("h-8 w-8", status.color)} />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-xl font-bold tracking-tight">{ticket.subject}</h1>
                </div>
                <div className="flex items-center gap-2 mt-2 flex-wrap">
                  <span className={cn(
                    "flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium",
                    status.bgColor, status.color
                  )}>
                    <StatusIcon className="h-3 w-3" />
                    {status.label}
                  </span>
                  <span className={cn(
                    "flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium",
                    priority.bgColor, priority.color
                  )}>
                    <AlertTriangle className="h-3 w-3" />
                    {priority.label} Öncelik
                  </span>
                  <span className="text-xs px-2 py-1 rounded-full bg-muted">
                    {departmentLabels[ticket.department] || ticket.department}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground mt-2">
                  {ticket.ticketNumber} &bull; Oluşturulma: {new Date(ticket.createdAt).toLocaleDateString("tr-TR")}
                </p>
              </div>
            </div>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem>
                  <Star className="mr-2 h-4 w-4" />
                  Öncelik Değiştir
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                {ticket.status !== "CLOSED" ? (
                  <DropdownMenuItem
                    className="text-red-500"
                    onClick={() => {
                      void handleCloseTicket();
                    }}
                  >
                    <XCircle className="mr-2 h-4 w-4" />
                    Talebi Kapat
                  </DropdownMenuItem>
                ) : (
                  <DropdownMenuItem
                    className="text-green-500"
                    onClick={() => {
                      void handleReopenTicket();
                    }}
                  >
                    <MessageSquare className="mr-2 h-4 w-4" />
                    Talebi Yeniden Aç
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </BlurFade>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Messages */}
        <div className="lg:col-span-2 space-y-6">
          <BlurFade delay={0.15} inView>
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <MessageSquare className="h-5 w-5 text-primary" />
                  Mesajlar ({ticket.messages.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {ticket.messages.map((message) => (
                  <div
                    key={message.id}
                    className={cn(
                      "p-4 rounded-lg",
                      message.senderRole === "CUSTOMER"
                        ? "bg-primary/5 border border-primary/20"
                        : "bg-muted/50 border"
                    )}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          "w-10 h-10 rounded-full flex items-center justify-center",
                          message.senderRole === "CUSTOMER"
                            ? "bg-primary/10"
                            : "bg-green-500/10"
                        )}>
                          <User className={cn(
                            "h-5 w-5",
                            message.senderRole === "CUSTOMER"
                              ? "text-primary"
                              : "text-green-500"
                          )} />
                        </div>
                        <div>
                          <p className="font-semibold">{message.senderName}</p>
                          {message.senderRole === "ADMIN" && (
                            <p className="text-xs text-muted-foreground">Destek Uzmanı</p>
                          )}
                        </div>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {new Date(message.createdAt).toLocaleDateString("tr-TR", {
                          day: "numeric",
                          month: "long",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>

                    <div className="whitespace-pre-wrap text-sm leading-relaxed">
                      {message.message}
                    </div>

                    {message.attachments && message.attachments.length > 0 && (
                      <div className="mt-4 pt-4 border-t">
                        <p className="text-xs text-muted-foreground mb-2">Ekler:</p>
                        <div className="flex flex-wrap gap-2">
                          {message.attachments.map((attachment, index) => (
                            <div
                              key={index}
                              className="flex items-center gap-2 px-3 py-2 rounded-lg bg-background border hover:shadow-sm transition-shadow cursor-pointer"
                            >
                              {attachment.type === "image" ? (
                                <ImageIcon className="h-4 w-4 text-blue-500" />
                              ) : (
                                <FileText className="h-4 w-4 text-orange-500" />
                              )}
                              <div>
                                <p className="text-sm font-medium">{attachment.name}</p>
                                <p className="text-xs text-muted-foreground">{attachment.size}</p>
                              </div>
                              <Download className="h-4 w-4 text-muted-foreground ml-2" />
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          </BlurFade>

          {/* Reply Form */}
          {ticket.status !== "CLOSED" ? (
            <BlurFade delay={0.2} inView>
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Yanıt Yaz</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Textarea
                    placeholder="Mesajınızı yazın..."
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    rows={5}
                    className="resize-none"
                  />
                  <div className="flex items-center justify-between">
                    <Button variant="outline" size="sm">
                      <Paperclip className="mr-2 h-4 w-4" />
                      Dosya Ekle
                    </Button>
                    <Button
                      onClick={handleSubmit}
                      disabled={!replyText.trim() || isSubmitting}
                    >
                      <Send className="mr-2 h-4 w-4" />
                      {isSubmitting ? "Gönderiliyor..." : "Gönder"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </BlurFade>
          ) : (
            <BlurFade delay={0.2} inView>
              <Card className="border-dashed">
                <CardContent className="p-6">
                  <div className="flex items-center gap-3 text-muted-foreground">
                    <Lock className="h-5 w-5" />
                    <div>
                      <p className="font-medium">Bu talep kapatılmıştır</p>
                      <p className="text-sm">Yeni bir mesaj göndermek için talebi yeniden açabilirsiniz.</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </BlurFade>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Ticket Info */}
          <BlurFade delay={0.25} inView>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Talep Bilgileri</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3 text-sm">
                  <div className="flex items-center gap-3">
                    <Tag className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-xs text-muted-foreground">Talep No</p>
                      <p className="font-medium">{ticket.ticketNumber}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Building className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-xs text-muted-foreground">Departman</p>
                      <p className="font-medium">{departmentLabels[ticket.department] || ticket.department}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-xs text-muted-foreground">Oluşturulma</p>
                      <p className="font-medium">
                        {new Date(ticket.createdAt).toLocaleDateString("tr-TR", {
                          day: "numeric",
                          month: "long",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <AlertCircle className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-xs text-muted-foreground">Öncelik</p>
                      <p className={cn("font-medium", priority.color)}>{priority.label}</p>
                    </div>
                  </div>
                </div>

                {ticket.relatedServiceId && (
                  <div className="pt-4 border-t">
                    <p className="text-xs text-muted-foreground mb-2">İlgili Hizmet</p>
                    <div className="p-3 rounded-lg bg-muted/50">
                      <p className="text-sm font-medium">{ticket.relatedServiceId}</p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </BlurFade>

          {/* Quick Actions */}
          <BlurFade delay={0.3} inView>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Hızlı İşlemler</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Button variant="outline" className="w-full justify-start">
                  <Star className="mr-2 h-4 w-4" />
                  Önceliği Yükselt
                </Button>
                {ticket.status !== "CLOSED" ? (
                  <Button
                    variant="outline"
                    className="w-full justify-start text-red-500 hover:text-red-600"
                    onClick={() => {
                      void handleCloseTicket();
                    }}
                  >
                    <XCircle className="mr-2 h-4 w-4" />
                    Talebi Kapat
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    className="w-full justify-start text-green-500 hover:text-green-600"
                    onClick={() => {
                      void handleReopenTicket();
                    }}
                  >
                    <MessageSquare className="mr-2 h-4 w-4" />
                    Yeniden Aç
                  </Button>
                )}
              </CardContent>
            </Card>
          </BlurFade>

          {/* Help */}
          <BlurFade delay={0.35} inView>
            <Card className="border-dashed">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <Headphones className="h-4 w-4 text-primary" />
                  </div>
                  <div className="text-sm">
                    <p className="font-medium mb-1">Acil Destek</p>
                    <p className="text-muted-foreground">
                      Acil durumlar için 7/24 telefon desteğimizi arayabilirsiniz.
                    </p>
                    <p className="font-semibold text-primary mt-2">
                      0850 123 45 67
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </BlurFade>
        </div>
      </div>
    </div>
  );
}
