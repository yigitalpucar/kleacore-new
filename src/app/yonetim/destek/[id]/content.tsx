"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Send,
  CheckCircle,
  Clock,
  Package,
  Paperclip,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  assignTicket,
  closeTicket,
  reopenTicket,
  replyToTicket,
} from "@/lib/actions/admin/tickets";
import { toast } from "@/lib/toast";

interface TicketMessage {
  id: string;
  ticketId: string;
  senderId: string;
  senderName: string;
  senderRole: string;
  message: string;
  attachments: unknown;
  createdAt: Date;
}

interface TicketData {
  id: string;
  ticketNumber: string;
  subject: string;
  department: string;
  priority: string;
  status: string;
  assignedTo: string | null;
  createdAt: Date;
  updatedAt: Date;
  customer: {
    id: string;
    name: string;
    surname: string;
    email: string;
    phone: string | null;
  };
  messages: TicketMessage[];
}

interface TicketDetailContentProps {
  ticket: TicketData;
  adminUsers: Array<{
    id: string;
    name: string;
    surname: string;
    email: string;
  }>;
}

const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  OPEN: { label: "Açık", variant: "secondary" },
  CUSTOMER_REPLY: { label: "Müşteri Yanıtı", variant: "secondary" },
  ADMIN_REPLY: { label: "Admin Yanıtı", variant: "outline" },
  WAITING: { label: "Yanıt Bekliyor", variant: "outline" },
  CLOSED: { label: "Kapalı", variant: "default" },
};

const priorityConfig: Record<string, { label: string; color: string }> = {
  URGENT: { label: "Acil", color: "text-red-500" },
  HIGH: { label: "Yüksek", color: "text-red-500" },
  MEDIUM: { label: "Orta", color: "text-yellow-500" },
  LOW: { label: "Düşük", color: "text-green-500" },
};

const departmentConfig: Record<string, string> = {
  GENERAL: "Genel",
  TECHNICAL: "Teknik Destek",
  BILLING: "Muhasebe",
  SALES: "Satış",
};

const quickReplies = [
  "Talebiniz için teşekkürler. İnceliyorum.",
  "DNS propagasyonu 24-48 saat sürebilir.",
  "Lütfen tarayıcı önbelleğinizi temizleyin.",
  "Sorununuz çözüldü mü?",
];

export function TicketDetailContent({
  ticket,
  adminUsers,
}: TicketDetailContentProps) {
  const router = useRouter();
  const [replyText, setReplyText] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isAssigning, setIsAssigning] = useState(false);
  const [assignedAdminId, setAssignedAdminId] = useState(
    ticket.assignedTo ?? ""
  );

  const customerFullName = `${ticket.customer.name} ${ticket.customer.surname}`;
  const statusInfo = statusConfig[ticket.status] || { label: ticket.status, variant: "secondary" as const };
  const priorityInfo = priorityConfig[ticket.priority] || { label: ticket.priority, color: "text-zinc-500" };

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
    <div className="space-y-6">
      {/* Back Button */}
      <Link
        href="/yonetim/destek"
        className="inline-flex items-center gap-2 text-sm text-zinc-400 hover:text-white transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Destek Taleplerine Dön
      </Link>

      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-xl font-bold text-white">{ticket.subject}</h1>
            <Badge variant={statusInfo.variant}>
              {statusInfo.label}
            </Badge>
          </div>
          <div className="flex items-center gap-4 text-sm text-zinc-400">
            <span>{ticket.ticketNumber}</span>
            <span>-</span>
            <span>{departmentConfig[ticket.department] || ticket.department}</span>
            <span>-</span>
            <span className={priorityInfo.color}>
              {priorityInfo.label} Öncelik
            </span>
          </div>
        </div>
        <div className="flex gap-2">
          {ticket.status !== "CLOSED" ? (
            <Button className="bg-green-600 hover:bg-green-700" onClick={handleClose}>
              <CheckCircle className="mr-2 h-4 w-4" />
              Kapat
            </Button>
          ) : (
            <Button
              variant="outline"
              className="border-zinc-700"
              onClick={handleReopen}
            >
              <Clock className="mr-2 h-4 w-4" />
              Yeniden Aç
            </Button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Messages */}
        <div className="lg:col-span-2 space-y-6">
          {/* Message Thread */}
          <Card className="bg-zinc-900 border-zinc-800">
            <CardContent className="p-0">
              <div className="divide-y divide-zinc-800">
                {ticket.messages.map((message) => (
                  <div key={message.id} className="p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          "flex h-9 w-9 items-center justify-center rounded-full text-sm font-medium",
                          message.senderRole === "ADMIN"
                            ? "bg-primary text-white"
                            : "bg-zinc-700 text-zinc-300"
                        )}>
                          {message.senderName.split(" ").map((n) => n[0]).join("")}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-white">{message.senderName}</p>
                          <p className="text-xs text-zinc-500">
                            {new Date(message.createdAt).toLocaleDateString("tr-TR")} {new Date(message.createdAt).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })}
                          </p>
                        </div>
                      </div>
                      {message.senderRole === "ADMIN" && (
                        <Badge variant="outline" className="text-xs">
                          Personel
                        </Badge>
                      )}
                    </div>
                    <div className="pl-12">
                      <p className="text-sm text-zinc-300 whitespace-pre-wrap">{message.message}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Reply Form */}
          {ticket.status !== "CLOSED" && (
            <Card className="bg-zinc-900 border-zinc-800">
              <CardHeader>
                <CardTitle className="text-white text-base">Yanıt Yaz</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Quick Replies */}
                <div className="flex flex-wrap gap-2">
                  {quickReplies.map((reply, index) => (
                    <Button
                      key={index}
                      variant="outline"
                      size="sm"
                      className="border-zinc-700 text-zinc-400 hover:text-white text-xs"
                      onClick={() => setReplyText(reply)}
                    >
                      {reply}
                    </Button>
                  ))}
                </div>

                <Textarea
                  placeholder="Yanıtınızı yazın..."
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  className="min-h-32 bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-500"
                />

                <div className="flex items-center justify-between">
                  <Button variant="ghost" size="sm" className="text-zinc-400 hover:text-white">
                    <Paperclip className="mr-2 h-4 w-4" />
                    Dosya Ekle
                  </Button>
                  <Button
                    className="bg-primary hover:bg-primary/90"
                    onClick={handleReply}
                    disabled={isSubmitting || !replyText.trim()}
                  >
                    <Send className="mr-2 h-4 w-4" />
                    {isSubmitting ? "Gönderiliyor..." : "Yanıtla"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right Column */}
        <div className="space-y-6">
          {/* Ticket Info */}
          <Card className="bg-zinc-900 border-zinc-800">
            <CardHeader>
              <CardTitle className="text-white text-base">Talep Bilgileri</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-zinc-500">Departman</span>
                <span className="text-sm text-zinc-300">
                  {departmentConfig[ticket.department] || ticket.department}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-zinc-500">Oluşturulma</span>
                <span className="text-sm text-zinc-300">
                  {new Date(ticket.createdAt).toLocaleDateString("tr-TR")}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-zinc-500">Son Güncelleme</span>
                <span className="text-sm text-zinc-300">
                  {new Date(ticket.updatedAt).toLocaleDateString("tr-TR")}
                </span>
              </div>
              <div className="pt-2 border-t border-zinc-800 space-y-2">
                <Label className="text-zinc-400 text-xs">Atanan Personel</Label>
                <Select
                  value={assignedAdminId}
                  onValueChange={setAssignedAdminId}
                >
                  <SelectTrigger className="bg-zinc-800 border-zinc-700 text-white">
                    <SelectValue placeholder="Personel seçin" />
                  </SelectTrigger>
                  <SelectContent className="bg-zinc-900 border-zinc-800 text-zinc-100">
                    {adminUsers.map((admin) => (
                      <SelectItem key={admin.id} value={admin.id}>
                        {admin.name} {admin.surname}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  className="w-full"
                  size="sm"
                  onClick={() => {
                    void handleAssign();
                  }}
                  disabled={isAssigning || !assignedAdminId}
                >
                  {isAssigning ? "Atanıyor..." : "Personeli Ata"}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Customer */}
          <Card className="bg-zinc-900 border-zinc-800">
            <CardHeader>
              <CardTitle className="text-white text-base">Müşteri</CardTitle>
            </CardHeader>
            <CardContent>
              <Link
                href={`/yonetim/musteriler/${ticket.customer.id}`}
                className="flex items-center gap-3 p-3 rounded-lg bg-zinc-800/50 hover:bg-zinc-800 transition-colors"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-700 text-white text-sm font-medium">
                  {customerFullName.split(" ").map((n) => n[0]).join("")}
                </div>
                <div>
                  <p className="text-sm font-medium text-white">{customerFullName}</p>
                  <p className="text-xs text-zinc-500">{ticket.customer.email}</p>
                </div>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
