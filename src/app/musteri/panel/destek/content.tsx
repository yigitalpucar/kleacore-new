"use client";

import { useState } from "react";
import Link from "next/link";
import { BlurFade } from "@/components/magicui/blur-fade";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Headphones,
  Search,
  Plus,
  MessageSquare,
  CheckCircle2,
  Clock,
  ChevronRight,
  Calendar,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface TicketItem {
  id: string;
  ticketNumber: string;
  subject: string;
  department: string;
  priority: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
}

interface DestekListContentProps {
  tickets: TicketItem[];
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
    icon: CheckCircle2,
  },
};

const priorityConfig: Record<string, { label: string; color: string }> = {
  LOW: { label: "Düşük", color: "text-gray-500" },
  MEDIUM: { label: "Normal", color: "text-blue-500" },
  HIGH: { label: "Yüksek", color: "text-red-500" },
  URGENT: { label: "Acil", color: "text-red-700" },
};

const departmentLabels: Record<string, string> = {
  GENERAL: "Genel",
  TECHNICAL: "Teknik Destek",
  BILLING: "Muhasebe",
  SALES: "Satış",
};

const filterOptions = [
  { value: "all", label: "Tümü" },
  { value: "OPEN", label: "Açık" },
  { value: "WAITING", label: "Beklemede" },
  { value: "CUSTOMER_REPLY", label: "Yanıt Bekliyor" },
  { value: "ADMIN_REPLY", label: "Yanıtlandı" },
  { value: "CLOSED", label: "Kapalı" },
];

export function DestekListContent({ tickets }: DestekListContentProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [filter, setFilter] = useState("all");

  const filteredTickets = tickets.filter((ticket) => {
    const matchesSearch =
      ticket.ticketNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ticket.subject.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFilter = filter === "all" || ticket.status === filter;
    return matchesSearch && matchesFilter;
  });

  const stats = {
    total: tickets.length,
    open: tickets.filter((t) => t.status === "OPEN").length,
    answered: tickets.filter((t) => t.status === "ADMIN_REPLY").length,
    waiting: tickets.filter(
      (t) => t.status === "CUSTOMER_REPLY" || t.status === "WAITING"
    ).length,
  };

  const hasTickets = tickets.length > 0;
  const isFilteredEmpty = hasTickets && filteredTickets.length === 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <BlurFade delay={0.1} inView>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Destek Talepleri</h1>
            <p className="text-muted-foreground">
              Destek taleplerinizi görüntüleyin ve yönetin.
            </p>
          </div>
          <Link href="/musteri/panel/destek/yeni">
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Yeni Talep
            </Button>
          </Link>
        </div>
      </BlurFade>

      {/* Stats */}
      <BlurFade delay={0.15} inView>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-blue-500/10">
                  <Headphones className="h-5 w-5 text-blue-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Toplam Talep</p>
                  <p className="text-2xl font-bold">{stats.total}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-blue-500/10">
                  <MessageSquare className="h-5 w-5 text-blue-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Açık</p>
                  <p className="text-2xl font-bold">{stats.open}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-green-500/10">
                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Yanıtlandı</p>
                  <p className="text-2xl font-bold">{stats.answered}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-orange-500/10">
                  <Clock className="h-5 w-5 text-orange-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Yanıt Bekleyen</p>
                  <p className="text-2xl font-bold">{stats.waiting}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </BlurFade>

      {/* Filters */}
      <BlurFade delay={0.2} inView>
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex flex-wrap gap-2">
                {filterOptions.map((option) => (
                  <Button
                    key={option.value}
                    variant={filter === option.value ? "default" : "outline"}
                    size="sm"
                    onClick={() => setFilter(option.value)}
                  >
                    {option.label}
                  </Button>
                ))}
              </div>
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Talep no veya konu ara..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
          </CardContent>
        </Card>
      </BlurFade>

      {/* Tickets List */}
      <BlurFade delay={0.25} inView>
        <Card>
          <CardHeader>
            <CardTitle>Talepler ({filteredTickets.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {filteredTickets.map((ticket) => {
                const status =
                  statusConfig[ticket.status] || statusConfig.OPEN;
                const priority =
                  priorityConfig[ticket.priority] || priorityConfig.MEDIUM;
                const StatusIcon = status.icon;

                return (
                  <Link
                    key={ticket.id}
                    href={`/musteri/panel/destek/${ticket.id}`}
                    className="flex items-center gap-4 p-4 rounded-lg border hover:shadow-sm transition-shadow cursor-pointer group"
                  >
                    <div className={cn("p-3 rounded-lg", status.bgColor)}>
                      <StatusIcon className={cn("h-6 w-6", status.color)} />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold">{ticket.subject}</p>
                        <span className="text-xs px-2 py-0.5 rounded-full bg-muted">
                          {departmentLabels[ticket.department] || ticket.department}
                        </span>
                        <span className={cn("text-xs font-medium", priority.color)}>
                          {priority.label}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                        <span>{ticket.ticketNumber}</span>
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {new Date(ticket.createdAt).toLocaleDateString("tr-TR")}
                        </span>
                        <span className="flex items-center gap-1">
                          <MessageSquare className="h-3 w-3" />
                          {ticket.messageCount} mesaj
                        </span>
                      </div>
                    </div>

                    <div className="hidden md:block text-right">
                      <div
                        className={cn(
                          "flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium mb-1",
                          status.bgColor,
                          status.color
                        )}
                      >
                        {status.label}
                      </div>
                      <p className="text-xs text-muted-foreground flex items-center justify-end gap-1">
                        <Clock className="h-3 w-3" />
                        {new Date(ticket.updatedAt).toLocaleDateString("tr-TR")}
                      </p>
                    </div>

                    <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-foreground transition-colors" />
                  </Link>
                );
              })}

              {!hasTickets && (
                <div className="text-center py-10">
                  <Headphones className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                  <p className="text-muted-foreground mb-4">Henüz destek talebiniz bulunmuyor.</p>
                  <Button asChild>
                    <Link href="/musteri/panel/destek/yeni">Yeni Talep Oluştur</Link>
                  </Button>
                </div>
              )}

              {isFilteredEmpty && (
                <div className="text-center py-8 text-muted-foreground">
                  Aramanızla eşleşen talep bulunamadı.
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </BlurFade>
    </div>
  );
}
