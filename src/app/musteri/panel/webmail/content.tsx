"use client";

import { useState } from "react";
import Link from "next/link";
import { ExternalLink, Forward, Loader2, Mail, PauseCircle, PlayCircle, Plus, Reply, Trash2 } from "lucide-react";
import {
  AppBreadcrumbLabel,
  CopyButton,
  DataTable,
  DetailList,
  EmptyState,
  FormField,
  IconTile,
  ListRow,
  PageHeader,
  SectionCard,
  StatCard,
  StatGrid,
  StatusBadge,
  appButton,
  getStatusOptions,
  type ColumnDef,
  type RowAction,
} from "@/components/app";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatDate } from "@/lib/format/date";
import { cn } from "@/lib/utils";
import { createEmailAccount, deleteEmailAccount, updateEmailAccountStatus } from "@/lib/actions/customer/emails";
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

const quotaOptions = [
  { value: "512", label: "512 MB" },
  { value: "1024", label: "1 GB" },
  { value: "2048", label: "2 GB" },
  { value: "5120", label: "5 GB" },
  { value: "10240", label: "10 GB" },
];

function formatBytes(mb: number): string {
  if (mb >= 1024) return `${(mb / 1024).toLocaleString("tr-TR", { maximumFractionDigits: 1 })} GB`;
  return `${mb.toLocaleString("tr-TR")} MB`;
}

function getUsagePercentage(used: number, quota: number): number {
  if (quota === 0) return 0;
  return Math.round((used / quota) * 100);
}

const statusEnum = { active: "ACTIVE", suspended: "SUSPENDED", closed: "CLOSED" } as const;

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

function QuotaBar({ used, quota, className }: { used: number; quota: number; className?: string }) {
  const pct = Math.min(100, getUsagePercentage(used, quota));
  const fill = pct >= 90 ? "bg-red-500" : pct >= 70 ? "bg-amber-500" : "bg-foreground";
  return (
    <div className={cn("w-full min-w-[160px] max-w-[220px] space-y-1", className)}>
      <div className="flex items-baseline justify-between gap-2 text-xs">
        <span className="whitespace-nowrap tabular-nums">
          {formatBytes(used)} <span className="text-muted-foreground">/ {formatBytes(quota)}</span>
        </span>
        <span className="tabular-nums text-muted-foreground">%{pct}</span>
      </div>
      <div
        role="meter"
        aria-label="Kota kullanımı"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
        className="h-1 overflow-hidden rounded-full bg-muted"
      >
        <div className={cn("h-full rounded-full", fill)} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function AccountFlags({ account }: { account: EmailAccount }) {
  if (!account.forwardTo && !account.autoResponder) return null;
  return (
    <span className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
      {account.forwardTo ? (
        <span className="inline-flex items-center gap-1" title={`Yönlendirme: ${account.forwardTo}`}>
          <Forward aria-hidden className="size-3" />
          Yönlendirmeli
        </span>
      ) : null}
      {account.autoResponder ? (
        <span className="inline-flex items-center gap-1">
          <Reply aria-hidden className="size-3" />
          Otomatik yanıt
        </span>
      ) : null}
    </span>
  );
}

export function WebmailContent({ emailAccounts, domains, stats }: WebmailContentProps) {
  const [accounts, setAccounts] = useState(emailAccounts);
  const [statsState, setStatsState] = useState(stats);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [newEmailDomain, setNewEmailDomain] = useState(domains[0]?.value || "");
  const [newEmailQuota, setNewEmailQuota] = useState("2048");
  const [isCreating, setIsCreating] = useState(false);
  const [processingAccountId, setProcessingAccountId] = useState<string | null>(null);

  const recalculateStats = (items: EmailAccount[]) => {
    const totalAccounts = items.length;
    const activeAccounts = items.filter((item) => item.status === "active").length;
    const totalStorage = items.reduce((sum, item) => sum + item.quota, 0);
    const usedStorage = items.reduce((sum, item) => sum + item.used, 0);
    setStatsState({ totalAccounts, activeAccounts, totalStorage, usedStorage });
  };

  const handleCreateEmail = async () => {
    if (isCreating) return;

    if (!newEmail.trim()) {
      toast.error("Lütfen e-posta kullanıcı adını girin.");
      return;
    }

    if (!newEmailDomain) {
      toast.error("Lütfen bir alan adı seçin.");
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
          ? { ...item, status: (nextStatus === "ACTIVE" ? "active" : "suspended") as EmailAccount["status"] }
          : item
      );

      setAccounts(updated);
      recalculateStats(updated);
      toast.success(nextStatus === "ACTIVE" ? "Hesap aktifleştirildi." : "Hesap askıya alındı.");
    } finally {
      setProcessingAccountId(null);
    }
  };

  const handleDeleteAccount = async (account: EmailAccount) => {
    if (processingAccountId) return;

    const approved = window.confirm(
      `${account.email} hesabını silmek istediğinize emin misiniz? Hesaptaki tüm e-postalar silinir.`
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

  const openWebmail = (client: (typeof webmailClients)[0], email?: string) => {
    const url = email ? `${client.url}?_user=${encodeURIComponent(email)}` : client.url;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const rowActions = (account: EmailAccount): RowAction[] => {
    const busy = processingAccountId ? "İşlem sürüyor" : undefined;
    const clients: RowAction[] =
      account.status === "active"
        ? webmailClients.map((client) => ({
            label: `${client.name} ile aç${client.recommended ? " (önerilen)" : ""}`,
            icon: <ExternalLink aria-hidden />,
            onSelect: () => openWebmail(client, account.email),
          }))
        : [];
    return [
      ...clients,
      {
        label: account.status === "active" ? "Askıya al" : "Aktifleştir",
        icon: account.status === "active" ? <PauseCircle aria-hidden /> : <PlayCircle aria-hidden />,
        onSelect: () => void handleToggleStatus(account),
        disabledReason: busy,
        separator: clients.length > 0,
      },
      {
        label: "Hesabı sil",
        icon: <Trash2 aria-hidden />,
        onSelect: () => void handleDeleteAccount(account),
        disabledReason: busy,
        destructive: true,
        separator: true,
      },
    ];
  };

  const WebmailButton = ({ account }: { account: EmailAccount }) =>
    account.status === "active" ? (
      <button
        type="button"
        className={appButton({ variant: "outline", size: "sm" })}
        onClick={() => openWebmail(webmailClients[0], account.email)}
        disabled={processingAccountId === account.id}
        aria-label={`${account.email} için webmail'i aç`}
      >
        {processingAccountId === account.id ? <Loader2 aria-hidden className="animate-spin" /> : <ExternalLink aria-hidden />}
        Webmail
      </button>
    ) : null;

  const columns: ColumnDef<EmailAccount>[] = [
    {
      accessorKey: "email",
      header: "E-posta adresi",
      cell: ({ row }) => {
        const a = row.original;
        return (
          <div className="min-w-0 space-y-1">
            <span className="inline-flex items-center gap-1 font-medium">
              {a.email}
              <CopyButton value={a.email} label="E-posta adresini kopyala" />
            </span>
            <AccountFlags account={a} />
          </div>
        );
      },
    },
    {
      id: "usage",
      accessorFn: (a) => getUsagePercentage(a.used, a.quota),
      header: "Kota",
      cell: ({ row }) => <QuotaBar used={row.original.used} quota={row.original.quota} />,
    },
    {
      id: "lastLogin",
      accessorFn: (a) => a.lastLogin ?? "",
      header: "Son giriş",
      cell: ({ row }) => (
        <span className="tabular-nums text-muted-foreground">
          {row.original.lastLogin ? formatDate(row.original.lastLogin) : "Hiç"}
        </span>
      ),
    },
    {
      accessorKey: "status",
      header: "Durum",
      enableSorting: false,
      cell: ({ row }) => <StatusBadge kind="emailAccount" status={statusEnum[row.original.status]} />,
    },
    {
      id: "webmail",
      header: () => <span className="sr-only">Webmail</span>,
      enableSorting: false,
      meta: { align: "right", className: "w-px" },
      cell: ({ row }) => <WebmailButton account={row.original} />,
    },
  ];

  const usedPct = getUsagePercentage(statsState.usedStorage, statsState.totalStorage);
  const domainFilterOptions = domains.filter((d) => accounts.some((a) => a.domain.toLowerCase() === d.value.toLowerCase()));

  return (
    <>
      <AppBreadcrumbLabel segment="webmail" label="E-posta hesapları" />
      <PageHeader
        title="E-posta hesapları"
        description="Alan adlarınıza ait e-posta hesaplarını oluşturun, yönetin ve webmail ile erişin."
        actions={
          <button
            type="button"
            className={appButton()}
            disabled={domains.length === 0}
            onClick={() => setIsCreateDialogOpen(true)}
          >
            <Plus aria-hidden />
            Yeni e-posta hesabı
          </button>
        }
        meta={
          domains.length === 0 ? (
            <span>
              E-posta hesabı oluşturmak için önce{" "}
              <Link href="/musteri/panel/domainler" className="font-medium text-foreground underline-offset-4 hover:underline">
                aktif bir alan adınız
              </Link>{" "}
              olmalı.
            </span>
          ) : undefined
        }
      />

      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Yeni e-posta hesabı</DialogTitle>
            <DialogDescription>Alan adlarınızdan birinde yeni bir posta kutusu oluşturun.</DialogDescription>
          </DialogHeader>
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              void handleCreateEmail();
            }}
          >
            <FormField label="E-posta adresi" htmlFor="new-email-local" required>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <input
                  id="new-email-local"
                  placeholder="kullanici"
                  autoComplete="off"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  className="h-11 w-full min-w-0 flex-1 rounded-md border bg-background px-3 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:h-9"
                />
                <span aria-hidden className="hidden text-muted-foreground sm:inline">
                  @
                </span>
                <Select value={newEmailDomain} onValueChange={setNewEmailDomain} disabled={domains.length === 0}>
                  <SelectTrigger aria-label="Alan adı" className="h-11 w-full sm:w-[200px] md:h-9">
                    <SelectValue placeholder="Alan adı seçin" />
                  </SelectTrigger>
                  <SelectContent>
                    {domains.map((domain) => (
                      <SelectItem key={domain.value} value={domain.value}>
                        @{domain.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </FormField>
            <FormField label="Kota" htmlFor="new-email-quota">
              <Select value={newEmailQuota} onValueChange={setNewEmailQuota}>
                <SelectTrigger id="new-email-quota" className="h-11 md:h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {quotaOptions.map((q) => (
                    <SelectItem key={q.value} value={q.value}>
                      {q.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
            <DialogFooter className="gap-2 pt-2">
              <button
                type="button"
                className={appButton({ variant: "outline" })}
                onClick={() => setIsCreateDialogOpen(false)}
                disabled={isCreating}
              >
                Vazgeç
              </button>
              <button type="submit" className={appButton()} disabled={isCreating || !newEmail.trim() || !newEmailDomain}>
                {isCreating ? <Loader2 aria-hidden className="animate-spin" /> : null}
                {isCreating ? "Oluşturuluyor…" : "Hesabı oluştur"}
              </button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <StatGrid>
        <StatCard label="Toplam hesap" value={statsState.totalAccounts} />
        <StatCard
          label="Aktif"
          value={statsState.activeAccounts}
          tone={statsState.activeAccounts ? "success" : undefined}
          hint={
            statsState.totalAccounts - statsState.activeAccounts > 0
              ? `${statsState.totalAccounts - statsState.activeAccounts} hesap askıda veya kapalı`
              : "Tüm hesaplar aktif"
          }
        />
        <StatCard label="Toplam kota" value={formatBytes(statsState.totalStorage)} />
        <StatCard
          label="Kullanılan"
          value={formatBytes(statsState.usedStorage)}
          hint={statsState.totalStorage ? `Kotanın %${usedPct} kadarı` : undefined}
          tone={usedPct >= 90 ? "danger" : usedPct >= 70 ? "warning" : undefined}
        />
      </StatGrid>

      <DataTable
        caption="E-posta hesapları"
        columns={columns}
        data={accounts}
        getRowId={(a) => a.id}
        searchFn={(a, q) => a.email.toLocaleLowerCase("tr-TR").includes(q)}
        searchPlaceholder="E-posta hesabı ara…"
        filters={[
          {
            id: "status",
            label: "Durum",
            options: getStatusOptions("emailAccount")
              .filter((o) => accounts.some((a) => statusEnum[a.status] === o.value)),
            getValue: (a) => statusEnum[a.status],
          },
          ...(domainFilterOptions.length > 1
            ? [
                {
                  id: "domain",
                  label: "Alan adı",
                  variant: "select" as const,
                  allLabel: "Tüm alan adları",
                  options: domainFilterOptions,
                  getValue: (a: EmailAccount) =>
                    domainFilterOptions.find((d) => d.value.toLowerCase() === a.domain.toLowerCase())?.value,
                },
              ]
            : []),
        ]}
        rowActions={rowActions}
        mobileCard={(a) => (
          <div className="space-y-3">
            <ListRow
              leading={
                <IconTile size="sm">
                  <Mail />
                </IconTile>
              }
              title={<span className="block truncate">{a.email}</span>}
              subtitle={a.lastLogin ? `Son giriş ${formatDate(a.lastLogin)}` : "Henüz giriş yapılmadı"}
              meta={
                <>
                  <StatusBadge kind="emailAccount" status={statusEnum[a.status]} />
                  <AccountFlags account={a} />
                </>
              }
            />
            <div className="space-y-3 pl-11">
              <QuotaBar used={a.used} quota={a.quota} className="max-w-none" />
              <WebmailButton account={a} />
            </div>
          </div>
        )}
        emptyState={
          <EmptyState
            icon={Mail}
            title="Henüz e-posta hesabınız yok"
            description={
              domains.length
                ? "info@ veya ad.soyad@ gibi adresleri dakikalar içinde oluşturabilirsiniz."
                : "E-posta hesabı açmak için önce aktif bir alan adınız olmalı."
            }
            action={
              domains.length ? (
                <button type="button" className={appButton()} onClick={() => setIsCreateDialogOpen(true)}>
                  <Plus aria-hidden />
                  Yeni e-posta hesabı
                </button>
              ) : (
                <Link href="/domain" className={appButton()}>
                  Alan adı al
                </Link>
              )
            }
          />
        }
        noResultsText="Aramanızla eşleşen e-posta hesabı bulunamadı."
      />

      <div className="grid items-start gap-6 lg:grid-cols-2">
        <SectionCard title="Webmail" description="Tarayıcıdan posta kutunuza giriş yapın." flush>
          <ul className="divide-y">
            {webmailClients.map((client) => (
              <li key={client.name}>
                <button
                  type="button"
                  onClick={() => openWebmail(client)}
                  className="group flex min-h-[60px] w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:outline-none md:px-5"
                >
                  <IconTile size="sm" className="font-mono text-[11px] font-semibold text-foreground">
                    {client.icon}
                  </IconTile>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2 text-sm font-medium">
                      {client.name}
                      {client.recommended ? (
                        <span className="rounded border px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                          Önerilen
                        </span>
                      ) : null}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">{client.description}</span>
                  </span>
                  <ExternalLink aria-hidden className="size-4 shrink-0 text-muted-foreground transition-colors group-hover:text-foreground" />
                  <span className="sr-only">(yeni sekmede açılır)</span>
                </button>
              </li>
            ))}
          </ul>
        </SectionCard>

        <SectionCard title="E-posta istemcisi ayarları" description="Outlook, Apple Mail, Thunderbird veya telefonunuz için.">
          <div className="space-y-5">
            <div className="space-y-2">
              <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-muted-foreground">Gelen sunucu · IMAP</p>
              <DetailList
                items={[
                  { label: "Sunucu", value: "mail.kleacore.com", mono: true, copy: "mail.kleacore.com" },
                  { label: "Port", value: "993 (SSL/TLS)", mono: true },
                ]}
              />
            </div>
            <div className="space-y-2">
              <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-muted-foreground">Giden sunucu · SMTP</p>
              <DetailList
                items={[
                  { label: "Sunucu", value: "mail.kleacore.com", mono: true, copy: "mail.kleacore.com" },
                  { label: "Port", value: "465 (SSL/TLS) · 587 (STARTTLS)", mono: true },
                ]}
              />
            </div>
            <p className="text-xs text-muted-foreground">Kullanıcı adı olarak tam e-posta adresinizi kullanın.</p>
          </div>
        </SectionCard>
      </div>
    </>
  );
}
