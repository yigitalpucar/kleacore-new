"use client";

import { useState } from "react";
import { BlurFade } from "@/components/magicui/blur-fade";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Mail,
  Search,
  Plus,
  ExternalLink,
  HardDrive,
  Users,
  Settings,
  Trash2,
  Forward,
  Clock,
  MoreVertical,
  Copy,
  CheckCircle2,
  Globe,
  Loader2,
  PauseCircle,
  PlayCircle,
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
  createEmailAccount,
  deleteEmailAccount,
  updateEmailAccountStatus,
} from "@/lib/actions/customer/emails";
import { toast } from "@/lib/toast";

const webmailClients = [
  {
    name: "Roundcube",
    description: "Modern ve kullanıcı dostu arayüz",
    icon: "RC",
    url: "https://webmail.kleacore.com/roundcube",
    recommended: true,
  },
  {
    name: "Horde",
    description: "Gelişmiş özellikler ve takvim",
    icon: "HR",
    url: "https://webmail.kleacore.com/horde",
    recommended: false,
  },
  {
    name: "SquirrelMail",
    description: "Basit ve hızlı erişim",
    icon: "SM",
    url: "https://webmail.kleacore.com/squirrelmail",
    recommended: false,
  },
];

function formatBytes(mb: number): string {
  if (mb >= 1024) {
    return `${(mb / 1024).toFixed(1)} GB`;
  }
  return `${mb} MB`;
}

function getUsagePercentage(used: number, quota: number): number {
  if (quota === 0) return 0;
  return Math.round((used / quota) * 100);
}

interface EmailAccount {
  id: string;
  email: string;
  domain: string;
  quota: number;
  used: number;
  status: "active" | "suspended" | "closed";
  forwardTo: string | null;
  autoResponder: boolean;
  createdAt: string;
  lastLogin: string | null;
}

interface WebmailContentProps {
  emailAccounts: EmailAccount[];
  domains: { value: string; label: string }[];
  stats: {
    totalAccounts: number;
    activeAccounts: number;
    totalStorage: number;
    usedStorage: number;
  };
}

export function WebmailContent({ emailAccounts, domains, stats }: WebmailContentProps) {
  const [accounts, setAccounts] = useState(emailAccounts);
  const [statsState, setStatsState] = useState(stats);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedDomain, setSelectedDomain] = useState("all");
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [newEmailDomain, setNewEmailDomain] = useState(domains[0]?.value || "");
  const [newEmailQuota, setNewEmailQuota] = useState("2048");
  const [copiedEmail, setCopiedEmail] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [processingAccountId, setProcessingAccountId] = useState<string | null>(null);

  const filteredAccounts = accounts.filter((account) => {
    const matchesSearch =
      account.email.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesDomain =
      selectedDomain === "all" ||
      account.domain.toLowerCase() === selectedDomain.toLowerCase();
    return matchesSearch && matchesDomain;
  });

  const recalculateStats = (items: EmailAccount[]) => {
    const totalAccounts = items.length;
    const activeAccounts = items.filter((item) => item.status === "active").length;
    const totalStorage = items.reduce((sum, item) => sum + item.quota, 0);
    const usedStorage = items.reduce((sum, item) => sum + item.used, 0);
    setStatsState({ totalAccounts, activeAccounts, totalStorage, usedStorage });
  };

  const handleCopyEmail = async (email: string) => {
    try {
      await navigator.clipboard.writeText(email);
      setCopiedEmail(email);
      setTimeout(() => setCopiedEmail(null), 2000);
    } catch {
      toast.error("E-posta adresi kopyalanamadı.");
    }
  };

  const handleCreateEmail = async () => {
    if (isCreating) return;

    if (!newEmail.trim()) {
      toast.error("Lütfen e-posta kullanıcı adını girin.");
      return;
    }

    if (!newEmailDomain) {
      toast.error("Lütfen bir domain seçin.");
      return;
    }

    setIsCreating(true);
    try {
      const result = await createEmailAccount({
        localPart: newEmail,
        domain: newEmailDomain,
        quotaMb: Number(newEmailQuota),
      });

      if (!result.success || !result.data) {
        toast.error(result.error ?? "E-posta hesabı oluşturulamadı.");
        return;
      }

      const createdAccount: EmailAccount = {
        ...result.data,
        status: result.data.status as EmailAccount["status"],
      };
      const nextAccounts = [createdAccount, ...accounts];
      setAccounts(nextAccounts);
      recalculateStats(nextAccounts);

      setIsCreateDialogOpen(false);
      setNewEmail("");
      setNewEmailQuota("2048");
      toast.success("E-posta hesabı oluşturuldu.");
    } finally {
      setIsCreating(false);
    }
  };

  const handleToggleStatus = async (account: EmailAccount) => {
    if (processingAccountId) return;

    const nextStatus = account.status === "active" ? "SUSPENDED" : "ACTIVE";
    setProcessingAccountId(account.id);
    try {
      const result = await updateEmailAccountStatus(account.id, nextStatus);
      if (!result.success) {
        toast.error(result.error ?? "Hesap durumu güncellenemedi.");
        return;
      }

      const updated = accounts.map((item) =>
        item.id === account.id
          ? {
              ...item,
              status: (nextStatus === "ACTIVE"
                ? "active"
                : "suspended") as EmailAccount["status"],
            }
          : item
      );

      setAccounts(updated);
      recalculateStats(updated);
      toast.success(
        nextStatus === "ACTIVE"
          ? "Hesap aktifleştirildi."
          : "Hesap askıya alındı."
      );
    } finally {
      setProcessingAccountId(null);
    }
  };

  const handleDeleteAccount = async (account: EmailAccount) => {
    if (processingAccountId) return;

    const approved = window.confirm(
      `${account.email} hesabını silmek istediğinize emin misiniz?`
    );
    if (!approved) return;

    setProcessingAccountId(account.id);
    try {
      const result = await deleteEmailAccount(account.id);
      if (!result.success) {
        toast.error(result.error ?? "E-posta hesabı silinemedi.");
        return;
      }

      const updated = accounts.filter((item) => item.id !== account.id);
      setAccounts(updated);
      recalculateStats(updated);
      toast.success("E-posta hesabı silindi.");
    } finally {
      setProcessingAccountId(null);
    }
  };

  const openWebmail = (client: typeof webmailClients[0], email?: string) => {
    const url = email ? `${client.url}?_user=${encodeURIComponent(email)}` : client.url;
    window.open(url, "_blank");
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <BlurFade delay={0.1} inView>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Webmail</h1>
            <p className="text-muted-foreground">
              E-posta hesaplarınızı yönetin ve webmail erişimi sağlayın.
            </p>
          </div>
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button disabled={domains.length === 0}>
                <Plus className="mr-2 h-4 w-4" />
                Yeni E-posta
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Yeni E-posta Hesabı</DialogTitle>
                <DialogDescription>
                  Yeni bir e-posta hesabı oluşturun.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>E-posta Adresi</Label>
                  <div className="flex gap-2">
                    <Input
                      placeholder="kullanıcı"
                      value={newEmail}
                      onChange={(e) => setNewEmail(e.target.value)}
                      className="flex-1"
                    />
                    <span className="flex items-center text-muted-foreground">@</span>
                    <Select
                      value={newEmailDomain}
                      onValueChange={setNewEmailDomain}
                      disabled={domains.length === 0}
                    >
                      <SelectTrigger className="w-[180px]">
                        <SelectValue placeholder="Domain seçin" />
                      </SelectTrigger>
                      <SelectContent>
                        {domains.map((domain) => (
                          <SelectItem key={domain.value} value={domain.value}>
                            {domain.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Kota</Label>
                  <Select value={newEmailQuota} onValueChange={setNewEmailQuota}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="512">512 MB</SelectItem>
                      <SelectItem value="1024">1 GB</SelectItem>
                      <SelectItem value="2048">2 GB</SelectItem>
                      <SelectItem value="5120">5 GB</SelectItem>
                      <SelectItem value="10240">10 GB</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setIsCreateDialogOpen(false)}
                  disabled={isCreating}
                >
                  İptal
                </Button>
                <Button
                  onClick={() => void handleCreateEmail()}
                  disabled={isCreating || !newEmail.trim() || !newEmailDomain}
                >
                  {isCreating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {isCreating ? "Oluşturuluyor..." : "Oluştur"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
        {domains.length === 0 && (
          <p className="text-sm text-amber-600 dark:text-amber-400">
            E-posta hesabı oluşturmak için önce aktif bir domaininiz olmalı.
          </p>
        )}
      </BlurFade>

      {/* Stats */}
      <BlurFade delay={0.15} inView>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-blue-500/10">
                  <Mail className="h-5 w-5 text-blue-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Toplam Hesap</p>
                  <p className="text-2xl font-bold">{statsState.totalAccounts}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-green-500/10">
                  <Users className="h-5 w-5 text-green-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Aktif Hesap</p>
                  <p className="text-2xl font-bold">{statsState.activeAccounts}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-purple-500/10">
                  <HardDrive className="h-5 w-5 text-purple-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Toplam Kota</p>
                  <p className="text-2xl font-bold">{formatBytes(statsState.totalStorage)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-orange-500/10">
                  <HardDrive className="h-5 w-5 text-orange-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Kullanılan</p>
                  <p className="text-2xl font-bold">{formatBytes(statsState.usedStorage)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </BlurFade>

      {/* Quick Webmail Access */}
      <BlurFade delay={0.2} inView>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Globe className="h-5 w-5" />
              Hızlı Webmail Erişimi
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-3">
              {webmailClients.map((client) => (
                <button
                  key={client.name}
                  onClick={() => openWebmail(client)}
                  className={cn(
                    "flex items-start gap-3 p-4 rounded-lg border text-left transition-all hover:shadow-md",
                    client.recommended
                      ? "border-primary/50 bg-primary/5"
                      : "hover:border-primary/30"
                  )}
                >
                  <span className="text-sm font-bold px-2 py-1 rounded bg-muted">{client.icon}</span>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-medium">{client.name}</p>
                      {client.recommended && (
                        <Badge variant="secondary" className="text-xs">
                          Önerilen
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground mt-0.5">
                      {client.description}
                    </p>
                  </div>
                  <ExternalLink className="h-4 w-4 text-muted-foreground" />
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      </BlurFade>

      {/* Filters */}
      <BlurFade delay={0.25} inView>
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row gap-4">
              <Select value={selectedDomain} onValueChange={setSelectedDomain}>
                <SelectTrigger className="w-full sm:w-[200px]">
                  <SelectValue placeholder="Domain seçin" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tüm Domainler</SelectItem>
                  {domains.map((domain) => (
                    <SelectItem key={domain.value} value={domain.value}>
                      {domain.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="E-posta hesabı ara..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
          </CardContent>
        </Card>
      </BlurFade>

      {/* Email Accounts List */}
      <BlurFade delay={0.3} inView>
        <Card>
          <CardHeader>
            <CardTitle>E-posta Hesapları ({filteredAccounts.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {filteredAccounts.map((account) => {
                const usagePercent = getUsagePercentage(account.used, account.quota);
                const isHighUsage = usagePercent >= 80;
                const isProcessing = processingAccountId === account.id;

                return (
                  <div
                    key={account.id}
                    className="flex items-center gap-4 p-4 rounded-lg border hover:shadow-sm transition-shadow"
                  >
                    <div className={cn(
                      "p-3 rounded-lg",
                      account.status === "active" ? "bg-green-500/10" : "bg-gray-500/10"
                    )}>
                      <Mail className={cn(
                        "h-6 w-6",
                        account.status === "active" ? "text-green-500" : "text-gray-500"
                      )} />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold">{account.email}</p>
                        <button
                          onClick={() => void handleCopyEmail(account.email)}
                          className="p-1 rounded hover:bg-muted transition-colors"
                          title="Kopyala"
                        >
                          {copiedEmail === account.email ? (
                            <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                          ) : (
                            <Copy className="h-3.5 w-3.5 text-muted-foreground" />
                          )}
                        </button>
                        {account.status === "suspended" && (
                          <Badge variant="destructive" className="text-xs">
                            Askıda
                          </Badge>
                        )}
                        {account.forwardTo && (
                          <Badge variant="secondary" className="text-xs">
                            <Forward className="h-3 w-3 mr-1" />
                            Yönlendirmeli
                          </Badge>
                        )}
                        {account.autoResponder && (
                          <Badge variant="secondary" className="text-xs">
                            <Clock className="h-3 w-3 mr-1" />
                            Oto-Yanıt
                          </Badge>
                        )}
                      </div>

                      {/* Storage Progress */}
                      <div className="mt-2">
                        <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                          <span>
                            {formatBytes(account.used)} / {formatBytes(account.quota)}
                          </span>
                          <span className={isHighUsage ? "text-orange-500 font-medium" : ""}>
                            {usagePercent}%
                          </span>
                        </div>
                        <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                          <div
                            className={cn(
                              "h-full rounded-full transition-all",
                              isHighUsage ? "bg-orange-500" : "bg-primary"
                            )}
                            style={{ width: `${usagePercent}%` }}
                          />
                        </div>
                      </div>

                      <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Globe className="h-3 w-3" />
                          {account.domain}
                        </span>
                        {account.lastLogin && (
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            Son giriş: {account.lastLogin}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {account.status === "active" && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="outline" size="sm" disabled={isProcessing}>
                              <ExternalLink className="mr-2 h-4 w-4" />
                              Webmail
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {webmailClients.map((client) => (
                              <DropdownMenuItem
                                key={client.name}
                                onClick={() => openWebmail(client, account.email)}
                              >
                                <span className="mr-2 text-xs font-bold">{client.icon}</span>
                                {client.name}
                                {client.recommended && (
                                  <Badge variant="secondary" className="ml-2 text-xs">
                                    Önerilen
                                  </Badge>
                                )}
                              </DropdownMenuItem>
                            ))}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}

                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" disabled={isProcessing}>
                            {isProcessing ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <MoreVertical className="h-4 w-4" />
                            )}
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() => void handleToggleStatus(account)}
                          >
                            {account.status === "active" ? (
                              <>
                                <PauseCircle className="mr-2 h-4 w-4" />
                                Askıya Al
                              </>
                            ) : (
                              <>
                                <PlayCircle className="mr-2 h-4 w-4" />
                                Aktifleştir
                              </>
                            )}
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={() => void handleDeleteAccount(account)}
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Hesabı Sil
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                );
              })}

              {filteredAccounts.length === 0 && (
                <div className="text-center py-12 text-muted-foreground">
                  <Mail className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Aramanızla eşleşen e-posta hesabı bulunamadı.</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </BlurFade>

      {/* Email Client Settings */}
      <BlurFade delay={0.35} inView>
        <Card className="border-dashed">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-muted">
                <Settings className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="text-sm">
                <p className="font-medium text-foreground mb-2">E-posta İstemci Ayarları</p>
                <div className="grid gap-4 sm:grid-cols-2 text-muted-foreground">
                  <div>
                    <p className="font-medium text-foreground text-xs mb-1">Gelen Sunucu (IMAP)</p>
                    <p>mail.kleacore.com</p>
                    <p>Port: 993 (SSL/TLS)</p>
                  </div>
                  <div>
                    <p className="font-medium text-foreground text-xs mb-1">Giden Sunucu (SMTP)</p>
                    <p>mail.kleacore.com</p>
                    <p>Port: 465 (SSL/TLS) veya 587 (STARTTLS)</p>
                  </div>
                </div>
                <p className="mt-2 text-xs">
                  Kullanıcı adı olarak tam e-posta adresinizi kullanın.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </BlurFade>
    </div>
  );
}
