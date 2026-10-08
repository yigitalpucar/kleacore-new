"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  ArrowLeft,
  Bell,
  CreditCard,
  Headphones,
  Inbox,
  Loader2,
  Mail,
  MailOpen,
  Search,
  Server,
  Shield,
} from "lucide-react";
import { EmptyState, IconTile, PageHeader, StatCard, StatGrid, ToneDot } from "@/components/app";
import { formatDateTime } from "@/lib/format/date";
import { cn } from "@/lib/utils";
import { markEmailAsRead } from "@/lib/actions/customer/emails";
import { toast } from "@/lib/toast";

const categoryConfig = {
  billing: { label: "Fatura", icon: CreditCard },
  support: { label: "Destek", icon: Headphones },
  system: { label: "Sistem", icon: Bell },
  service: { label: "Hizmet", icon: Server },
  security: { label: "Güvenlik", icon: Shield },
  promotion: { label: "Kampanya", icon: AlertCircle },
} as const;

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
  content: string;
  sentAt: string;
  date: string;
  sentAtIso: string;
  isRead: boolean;
  source: "email" | "notification";
}

interface EPostaContentProps {
  emails: EmailItem[];
  stats: {
    total: number;
    unread: number;
    thisMonth: number;
  };
}

function getCategory(category: string) {
  return categoryConfig[category as keyof typeof categoryConfig] ?? { label: "Sistem", icon: Mail };
}

const trLower = (s: string) => s.toLocaleLowerCase("tr-TR");

export function EPostaContent({ emails, stats }: EPostaContentProps) {
  const [emailItems, setEmailItems] = useState(emails);
  const [statsState, setStatsState] = useState(stats);
  const [searchQuery, setSearchQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [openingEmailId, setOpeningEmailId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const inboxRef = useRef<HTMLElement>(null);
  const isPhone = () => typeof window !== "undefined" && window.matchMedia("(max-width: 767px)").matches;
  const showInboxTop = () => {
    if (isPhone()) inboxRef.current?.scrollIntoView({ block: "start" });
  };

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: emailItems.length, unread: emailItems.filter((e) => !e.isRead).length };
    for (const e of emailItems) c[e.category] = (c[e.category] ?? 0) + 1;
    return c;
  }, [emailItems]);

  const filteredEmails = emailItems.filter((email) => {
    const q = trLower(searchQuery.trim());
    const matchesSearch =
      !q || trLower(email.id).includes(q) || trLower(email.subject).includes(q) || trLower(email.preview).includes(q);
    if (filter === "all") return matchesSearch;
    if (filter === "unread") return matchesSearch && !email.isRead;
    return matchesSearch && email.category === filter;
  });

  const selected = emailItems.find((e) => e.id === selectedId) ?? null;

  const handleOpenEmail = async (email: EmailItem) => {
    setSelectedId(email.id);
    showInboxTop();
    // Notification fallback items aren't email records; there is nothing to mark on the server.
    if (email.isRead || openingEmailId || email.source !== "email") return;

    setOpeningEmailId(email.id);
    try {
      const result = await markEmailAsRead(email.id);
      if (!result.success) {
        toast.error(result.error ?? "E-posta durumu güncellenemedi.");
        return;
      }

      setEmailItems((prev) => prev.map((item) => (item.id === email.id ? { ...item, isRead: true } : item)));
      setStatsState((prev) => ({ ...prev, unread: Math.max(0, prev.unread - 1) }));
    } finally {
      setOpeningEmailId(null);
    }
  };

  return (
    <>
      <PageHeader
        title="E-postalarım"
        description="KLEACORE'un hesabınıza gönderdiği fatura, destek ve sistem e-postalarının kopyaları."
      />

      <StatGrid columns={3} className="grid-cols-3">
        <StatCard label="Toplam" value={statsState.total} />
        <StatCard label="Okunmamış" value={statsState.unread} tone={statsState.unread ? "info" : undefined} hint={statsState.unread ? "Yeni" : undefined} />
        <StatCard label="Bu ay" value={statsState.thisMonth} />
      </StatGrid>

      {emailItems.length === 0 ? (
        <EmptyState
          icon={Inbox}
          title="Henüz e-posta yok"
          description="Fatura, destek ve hizmet bildirimleri gönderildikçe burada listelenir."
        />
      ) : (
        <section
          ref={inboxRef}
          aria-label="Gelen kutusu"
          className="flex min-w-0 scroll-mt-20 overflow-hidden rounded-lg border bg-card shadow-sm md:h-[640px]"
        >
          {/* Message list */}
          <div
            className={cn(
              "flex w-full min-w-0 flex-col md:w-[360px] md:shrink-0 md:border-r lg:w-[400px]",
              selected && "hidden md:flex"
            )}
          >
            <div className="space-y-3 border-b p-3 md:p-4">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-sm font-semibold tracking-tight">Gelen kutusu</h2>
                <span className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
                  {filteredEmails.length} e-posta
                </span>
              </div>
              <div className="relative">
                <Search aria-hidden className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="search"
                  aria-label="E-posta ara"
                  placeholder="Konu veya içerik ara…"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-11 w-full rounded-md border bg-background pl-9 pr-3 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:h-9"
                />
              </div>
              <div role="group" aria-label="Filtre" className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-0.5 [scrollbar-width:none] md:flex-wrap md:overflow-visible">
                {filterOptions.map((option) => {
                  const active = filter === option.value;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      aria-pressed={active}
                      onClick={() => setFilter(option.value)}
                      className={cn(
                        "inline-flex h-10 shrink-0 items-center gap-1.5 rounded-md px-2.5 text-[13px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:h-8",
                        active ? "bg-foreground text-background" : "text-muted-foreground hover:bg-muted hover:text-foreground"
                      )}
                    >
                      {option.label}
                      <span className={cn("font-mono text-[10px]", active ? "text-background/70" : "text-muted-foreground/70")}>
                        {counts[option.value] ?? 0}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <ul className="min-h-0 flex-1 divide-y overflow-y-auto">
              {filteredEmails.map((email) => {
                const category = getCategory(email.category);
                const Icon = category.icon;
                const isSelected = selected?.id === email.id;
                return (
                  <li key={email.id}>
                    <button
                      type="button"
                      onClick={() => void handleOpenEmail(email)}
                      aria-current={isSelected ? "true" : undefined}
                      className={cn(
                        "relative flex w-full gap-3 px-3 py-3.5 text-left transition-colors hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:outline-none md:px-4",
                        isSelected && "bg-muted before:absolute before:inset-y-0 before:left-0 before:w-0.5 before:bg-foreground"
                      )}
                    >
                      <IconTile size="sm" className="mt-0.5">
                        <Icon />
                      </IconTile>
                      <span className="min-w-0 flex-1 space-y-0.5">
                        <span className="flex items-center justify-between gap-2">
                          <span className="flex min-w-0 items-center gap-1.5">
                            {!email.isRead ? <ToneDot tone="info" /> : null}
                            <span className={cn("truncate text-sm", email.isRead ? "text-foreground/90" : "font-semibold")}>
                              {email.subject}
                            </span>
                          </span>
                          <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{email.sentAt}</span>
                        </span>
                        <span className="line-clamp-2 block text-[13px] text-muted-foreground">{email.preview}</span>
                        <span className="block font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                          {category.label}
                          {!email.isRead ? <span className="sr-only"> · okunmamış</span> : null}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
              {filteredEmails.length === 0 ? (
                <li className="px-6 py-12 text-center text-sm text-muted-foreground">Aramanızla eşleşen e-posta bulunamadı.</li>
              ) : null}
            </ul>
          </div>

          {/* Reading pane */}
          <div className={cn("min-w-0 flex-1 flex-col", selected ? "flex" : "hidden md:flex")}>
            {selected ? (
              <article className="flex min-h-0 flex-1 flex-col" aria-labelledby="eposta-konu">
                <header className="space-y-3 border-b p-4 md:p-6">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedId(null);
                      showInboxTop();
                    }}
                    className="-ml-1 inline-flex h-10 items-center gap-1.5 rounded-md px-1 text-sm text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:hidden"
                  >
                    <ArrowLeft aria-hidden className="size-4" />
                    Gelen kutusu
                  </button>
                  <p className="font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                    {getCategory(selected.category).label}
                  </p>
                  <h2 id="eposta-konu" className="text-balance text-lg font-semibold tracking-tight md:text-xl">
                    {selected.subject}
                  </h2>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-muted-foreground">
                    <span>
                      Gönderen <span className="font-medium text-foreground">KLEACORE</span>
                    </span>
                    <time dateTime={selected.sentAtIso} className="tabular-nums">
                      {formatDateTime(selected.sentAtIso)}
                    </time>
                    {openingEmailId === selected.id ? (
                      <span className="inline-flex items-center gap-1">
                        <Loader2 aria-hidden className="size-3.5 animate-spin" />
                        İşaretleniyor…
                      </span>
                    ) : selected.isRead ? (
                      <span className="inline-flex items-center gap-1">
                        <MailOpen aria-hidden className="size-3.5" />
                        Okundu
                      </span>
                    ) : null}
                  </div>
                </header>
                <div className="min-h-0 flex-1 overflow-y-auto p-4 md:p-6">
                  <p className="max-w-prose whitespace-pre-line text-sm leading-relaxed">{selected.content || selected.preview}</p>
                </div>
              </article>
            ) : (
              <div className="flex flex-1 items-center justify-center p-6">
                <EmptyState
                  compact
                  icon={Mail}
                  title="Okumak için bir e-posta seçin"
                  description="Seçtiğiniz e-posta okundu olarak işaretlenir."
                  className="w-full max-w-sm border-0"
                />
              </div>
            )}
          </div>
        </section>
      )}

      <p className="text-[13px] text-muted-foreground">
        Hangi konularda e-posta alacağınızı{" "}
        <Link href="/musteri/panel/ayarlar" className="font-medium text-foreground underline-offset-4 hover:underline">
          Ayarlar
        </Link>{" "}
        sayfasındaki bildirim tercihlerinden değiştirebilirsiniz.
      </p>
    </>
  );
}
