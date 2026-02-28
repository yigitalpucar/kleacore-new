"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Search,
  MoreHorizontal,
  Eye,
  CheckCircle,
  Clock,
  Headphones,
  User,
  Timer,
  AlertCircle,
  MessageSquare,
  Plus,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { BlurFade } from "@/components/magicui/blur-fade";
import { closeTicket, reopenTicket } from "@/lib/actions/admin/tickets";
import { toast } from "@/lib/toast";

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
  };
  _count: {
    messages: number;
  };
}

interface DestekContentProps {
  data: TicketData[];
  total: number;
}

const statusConfig: Record<string, { label: string; color: string }> = {
  OPEN: { label: "Açık", color: "bg-blue-500/10 text-blue-500" },
  CUSTOMER_REPLY: { label: "Müşteri Yanıtı", color: "bg-orange-500/10 text-orange-500" },
  ADMIN_REPLY: { label: "Admin Yanıtı", color: "bg-purple-500/10 text-purple-500" },
  WAITING: { label: "Yanıt Bekliyor", color: "bg-yellow-500/10 text-yellow-500" },
  CLOSED: { label: "Kapalı", color: "bg-green-500/10 text-green-500" },
};

const priorityConfig: Record<string, { label: string; color: string }> = {
  URGENT: { label: "Acil", color: "bg-red-500/10 text-red-500" },
  HIGH: { label: "Yüksek", color: "bg-red-500/10 text-red-500" },
  MEDIUM: { label: "Orta", color: "bg-yellow-500/10 text-yellow-500" },
  LOW: { label: "Düşük", color: "bg-green-500/10 text-green-500" },
};

const departmentConfig: Record<string, string> = {
  GENERAL: "Genel",
  TECHNICAL: "Teknik Destek",
  BILLING: "Muhasebe",
  SALES: "Satış",
};

export function DestekContent({ data, total }: DestekContentProps) {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");

  const handleCloseTicket = async (ticketId: string) => {
    const result = await closeTicket(ticketId);
    if (!result.success) {
      toast.error(result.error ?? "Talep kapatılamadı");
      return;
    }

    toast.success("Talep kapatıldı");
    router.refresh();
  };

  const handleReopenTicket = async (ticketId: string) => {
    const result = await reopenTicket(ticketId);
    if (!result.success) {
      toast.error(result.error ?? "Talep yeniden açılamadı");
      return;
    }

    toast.success("Talep yeniden açıldı");
    router.refresh();
  };

  const filteredTickets = data.filter((ticket) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    const fullName = `${ticket.customer.name} ${ticket.customer.surname}`.toLowerCase();
    return (
      ticket.subject.toLowerCase().includes(q) ||
      fullName.includes(q) ||
      ticket.ticketNumber.toLowerCase().includes(q)
    );
  });

  const openCount = data.filter((t) => t.status === "OPEN" || t.status === "CUSTOMER_REPLY").length;
  const waitingCount = data.filter((t) => t.status === "WAITING" || t.status === "ADMIN_REPLY").length;
  const closedCount = data.filter((t) => t.status === "CLOSED").length;

  const stats = [
    {
      title: "Toplam Talepler",
      value: total.toString(),
      icon: Headphones,
      color: "text-blue-500",
      bgColor: "bg-blue-500/10",
    },
    {
      title: "Açık",
      value: openCount.toString(),
      icon: Clock,
      color: "text-orange-500",
      bgColor: "bg-orange-500/10",
    },
    {
      title: "Yanıt Bekliyor",
      value: waitingCount.toString(),
      icon: Timer,
      color: "text-yellow-500",
      bgColor: "bg-yellow-500/10",
    },
    {
      title: "Kapalı",
      value: closedCount.toString(),
      icon: CheckCircle,
      color: "text-green-500",
      bgColor: "bg-green-500/10",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <BlurFade delay={0}>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">Destek Talepleri</h1>
            <p className="text-zinc-600 dark:text-zinc-400">Müşteri destek taleplerini yönetin</p>
          </div>
          <Button className="bg-primary hover:bg-primary/90">
            <Plus className="mr-2 h-4 w-4" />
            Yeni Talep
          </Button>
        </div>
      </BlurFade>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat, index) => (
          <BlurFade key={stat.title} delay={0.05 + index * 0.05}>
            <Card className="bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 transition-colors">
              <CardContent className="p-4">
                <div className="flex items-center gap-4">
                  <div className={cn("p-3 rounded-lg", stat.bgColor)}>
                    <stat.icon className={cn("h-6 w-6", stat.color)} />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-zinc-900 dark:text-white">{stat.value}</p>
                    <p className="text-sm text-zinc-600 dark:text-zinc-400">{stat.title}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </BlurFade>
        ))}
      </div>

      {/* Search */}
      <BlurFade delay={0.25}>
        <Card className="bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800">
          <CardContent className="p-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
              <Input
                type="search"
                placeholder="Talep no, konu veya müşteri ara..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 bg-zinc-100 dark:bg-zinc-800 border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-white placeholder:text-zinc-500"
              />
            </div>
          </CardContent>
        </Card>
      </BlurFade>

      {/* Table */}
      <BlurFade delay={0.3}>
        <Card className="bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-zinc-200 dark:border-zinc-800">
                    <th className="text-left p-4 text-sm font-medium text-zinc-600 dark:text-zinc-400">Talep</th>
                    <th className="text-left p-4 text-sm font-medium text-zinc-600 dark:text-zinc-400">Müşteri</th>
                    <th className="text-left p-4 text-sm font-medium text-zinc-600 dark:text-zinc-400">Departman</th>
                    <th className="text-left p-4 text-sm font-medium text-zinc-600 dark:text-zinc-400">Öncelik</th>
                    <th className="text-left p-4 text-sm font-medium text-zinc-600 dark:text-zinc-400">Durum</th>
                    <th className="text-left p-4 text-sm font-medium text-zinc-600 dark:text-zinc-400">Son Güncelleme</th>
                    <th className="text-right p-4 text-sm font-medium text-zinc-600 dark:text-zinc-400">İşlemler</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTickets.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-8 text-center">
                        <div className="flex flex-col items-center gap-2">
                          <Headphones className="h-12 w-12 text-zinc-300 dark:text-zinc-700" />
                          <p className="text-zinc-500 dark:text-zinc-400">Talep bulunamadı</p>
                          <p className="text-sm text-zinc-400 dark:text-zinc-500">Arama kriterlerinizi değiştirmeyi deneyin</p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredTickets.map((ticket) => (
                      <tr
                        key={ticket.id}
                        className="border-b border-zinc-200 dark:border-zinc-800 last:border-0 hover:bg-zinc-100 dark:hover:bg-zinc-800/50 transition-colors"
                      >
                        <td className="p-4">
                          <Link
                            href={`/yonetim/destek/${ticket.id}`}
                            className="text-sm font-medium text-zinc-900 dark:text-white hover:text-primary"
                          >
                            {ticket.subject}
                          </Link>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-xs text-zinc-500">{ticket.ticketNumber}</span>
                            <span className="text-xs text-zinc-400">-</span>
                            <div className="flex items-center gap-1 text-zinc-500">
                              <MessageSquare className="h-3 w-3" />
                              <span className="text-xs">{ticket._count.messages}</span>
                            </div>
                          </div>
                        </td>
                        <td className="p-4">
                          <Link
                            href={`/yonetim/musteriler/${ticket.customer.id}`}
                            className="text-sm text-zinc-900 dark:text-white hover:text-primary"
                          >
                            {ticket.customer.name} {ticket.customer.surname}
                          </Link>
                        </td>
                        <td className="p-4">
                          <span className="text-sm text-zinc-600 dark:text-zinc-400">
                            {departmentConfig[ticket.department] || ticket.department}
                          </span>
                        </td>
                        <td className="p-4">
                          <span className={cn(
                            "inline-flex px-2 py-0.5 rounded text-xs font-medium",
                            priorityConfig[ticket.priority]?.color || "bg-zinc-500/10 text-zinc-500"
                          )}>
                            {priorityConfig[ticket.priority]?.label || ticket.priority}
                          </span>
                        </td>
                        <td className="p-4">
                          <span className={cn(
                            "inline-flex px-2 py-0.5 rounded text-xs font-medium",
                            statusConfig[ticket.status]?.color || "bg-zinc-500/10 text-zinc-500"
                          )}>
                            {statusConfig[ticket.status]?.label || ticket.status}
                          </span>
                        </td>
                        <td className="p-4">
                          <span className="text-sm text-zinc-600 dark:text-zinc-400">
                            {new Date(ticket.updatedAt).toLocaleDateString("tr-TR")}
                          </span>
                        </td>
                        <td className="p-4 text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0 text-zinc-500 hover:text-zinc-900 dark:hover:text-white"
                              >
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-48 bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800">
                              <DropdownMenuItem asChild>
                                <Link href={`/yonetim/destek/${ticket.id}`} className="flex items-center cursor-pointer">
                                  <Eye className="mr-2 h-4 w-4" />
                                  Görüntüle & Yanıtla
                                </Link>
                              </DropdownMenuItem>
                              <DropdownMenuSeparator className="bg-zinc-200 dark:bg-zinc-800" />
                              {ticket.status !== "CLOSED" ? (
                                <DropdownMenuItem
                                  onClick={async () => {
                                    await handleCloseTicket(ticket.id);
                                  }}
                                  className="flex items-center cursor-pointer text-green-600 dark:text-green-500"
                                >
                                  <CheckCircle className="mr-2 h-4 w-4" />
                                  Kapat
                                </DropdownMenuItem>
                              ) : (
                                <DropdownMenuItem
                                  onClick={async () => {
                                    await handleReopenTicket(ticket.id);
                                  }}
                                  className="flex items-center cursor-pointer text-blue-600 dark:text-blue-500"
                                >
                                  <AlertCircle className="mr-2 h-4 w-4" />
                                  Yeniden Aç
                                </DropdownMenuItem>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </BlurFade>
    </div>
  );
}
