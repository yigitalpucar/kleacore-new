"use client";

import { useState } from "react";
import { BlurFade } from "@/components/magicui/blur-fade";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Mail,
  Search,
  Inbox,
  FileText,
  Bell,
  CreditCard,
  Headphones,
  Clock,
  Eye,
  Calendar,
  ChevronRight,
  Server,
  Shield,
  AlertCircle,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { markEmailAsRead } from "@/lib/actions/customer/emails";
import { toast } from "@/lib/toast";

const categoryConfig = {
  billing: {
    label: "Fatura",
    color: "text-blue-500",
    bgColor: "bg-blue-500/10",
    icon: CreditCard,
  },
  support: {
    label: "Destek",
    color: "text-green-500",
    bgColor: "bg-green-500/10",
    icon: Headphones,
  },
  system: {
    label: "Sistem",
    color: "text-orange-500",
    bgColor: "bg-orange-500/10",
    icon: Bell,
  },
  service: {
    label: "Hizmet",
    color: "text-purple-500",
    bgColor: "bg-purple-500/10",
    icon: Server,
  },
  security: {
    label: "Güvenlik",
    color: "text-red-500",
    bgColor: "bg-red-500/10",
    icon: Shield,
  },
  promotion: {
    label: "Kampanya",
    color: "text-pink-500",
    bgColor: "bg-pink-500/10",
    icon: AlertCircle,
  },
};

const filterOptions = [
  { value: "all", label: "Tümü" },
  { value: "unread", label: "Okunmamış" },
  { value: "billing", label: "Fatura" },
  { value: "support", label: "Destek" },
  { value: "service", label: "Hizmet" },
];

interface EmailItem {
  id: string;
  subject: string;
  category: string;
  preview: string;
  sentAt: string;
  date: string;
  isRead: boolean;
}

interface EPostaContentProps {
  emails: EmailItem[];
  stats: {
    total: number;
    unread: number;
    thisMonth: number;
  };
}

export function EPostaContent({ emails, stats }: EPostaContentProps) {
  const [emailItems, setEmailItems] = useState(emails);
  const [statsState, setStatsState] = useState(stats);
  const [searchQuery, setSearchQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [openingEmailId, setOpeningEmailId] = useState<string | null>(null);

  const filteredEmails = emailItems.filter((email) => {
    const matchesSearch =
      email.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      email.subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
      email.preview.toLowerCase().includes(searchQuery.toLowerCase());

    if (filter === "all") return matchesSearch;
    if (filter === "unread") return matchesSearch && !email.isRead;
    return matchesSearch && email.category === filter;
  });

  const handleOpenEmail = async (email: EmailItem) => {
    if (email.isRead || openingEmailId) return;

    setOpeningEmailId(email.id);
    try {
      const result = await markEmailAsRead(email.id);
      if (!result.success) {
        toast.error(result.error ?? "E-posta durumu güncellenemedi.");
        return;
      }

      setEmailItems((prev) =>
        prev.map((item) =>
          item.id === email.id ? { ...item, isRead: true } : item
        )
      );
      setStatsState((prev) => ({
        ...prev,
        unread: Math.max(0, prev.unread - 1),
      }));
    } finally {
      setOpeningEmailId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <BlurFade delay={0.1} inView>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">E-Postalarım</h1>
            <p className="text-muted-foreground">
              Kleacore&apos;dan size gönderilen tüm e-postaları görüntüleyin.
            </p>
          </div>
        </div>
      </BlurFade>

      {/* Stats */}
      <BlurFade delay={0.15} inView>
        <div className="grid gap-4 sm:grid-cols-3">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-blue-500/10">
                  <Inbox className="h-5 w-5 text-blue-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Toplam E-posta</p>
                  <p className="text-2xl font-bold">{statsState.total}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-orange-500/10">
                  <Mail className="h-5 w-5 text-orange-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Okunmamış</p>
                  <p className="text-2xl font-bold">{statsState.unread}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-green-500/10">
                  <Calendar className="h-5 w-5 text-green-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Bu Ay</p>
                  <p className="text-2xl font-bold">{statsState.thisMonth}</p>
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
              <div className="flex gap-2 flex-wrap">
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
                  placeholder="E-posta ara..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
          </CardContent>
        </Card>
      </BlurFade>

      {/* Emails List */}
      <BlurFade delay={0.25} inView>
        <Card>
          <CardHeader>
            <CardTitle>Gelen Kutusu ({filteredEmails.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {filteredEmails.map((email) => {
                const category = categoryConfig[email.category as keyof typeof categoryConfig];
                const CategoryIcon = category?.icon || Mail;
                const isOpening = openingEmailId === email.id;

                return (
                  <div
                    key={email.id}
                    onClick={() => void handleOpenEmail(email)}
                    className={cn(
                      "flex items-center gap-4 p-4 rounded-lg border hover:shadow-sm transition-shadow cursor-pointer group",
                      !email.isRead && "bg-primary/5 border-primary/20"
                    )}
                  >
                    <div className={cn("p-3 rounded-lg", category?.bgColor || "bg-muted")}>
                      <CategoryIcon className={cn("h-5 w-5", category?.color || "text-muted-foreground")} />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        {!email.isRead && (
                          <span className="w-2 h-2 rounded-full bg-primary" />
                        )}
                        <p className={cn(
                          "font-medium truncate",
                          !email.isRead && "font-semibold"
                        )}>
                          {email.subject}
                        </p>
                      </div>
                      <p className="text-sm text-muted-foreground truncate mt-0.5">
                        {email.preview}
                      </p>
                      <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                        {category && (
                          <span className={cn("px-2 py-0.5 rounded-full", category.bgColor, category.color)}>
                            {category.label}
                          </span>
                        )}
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {email.sentAt}
                        </span>
                      </div>
                    </div>

                    <div className="hidden md:flex items-center gap-3">
                      <div className="text-right">
                        <p className="text-xs text-muted-foreground">{email.date}</p>
                        <p className="text-xs text-muted-foreground">{email.id}</p>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={(event) => {
                          event.stopPropagation();
                          void handleOpenEmail(email);
                        }}
                      >
                        {isOpening ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </Button>
                    </div>

                    <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-foreground transition-colors" />
                  </div>
                );
              })}

              {filteredEmails.length === 0 && (
                <div className="text-center py-12 text-muted-foreground">
                  <Mail className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Aramanızla eşleşen e-posta bulunamadı.</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </BlurFade>

      {/* Info Note */}
      <BlurFade delay={0.3} inView>
        <Card className="border-dashed">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-muted">
                <FileText className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="text-sm text-muted-foreground">
                <p className="font-medium text-foreground mb-1">E-posta Bildirimleri Hakkında</p>
                <p>
                  Bu sayfada Kleacore sisteminden hesabınıza gönderilen tüm e-postaları görüntüleyebilirsiniz.
                  Fatura, destek, sistem bildirimleri ve kampanya e-postaları bu listede yer almaktadır.
                  E-posta bildirim tercihlerinizi <span className="text-primary">Ayarlar</span> sayfasından düzenleyebilirsiniz.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </BlurFade>
    </div>
  );
}
