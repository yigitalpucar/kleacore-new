"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BookOpen, KeyRound, Plus, Trash2, TriangleAlert } from "lucide-react";
import {
  CopyButton,
  DataTable,
  EmptyState,
  FormField,
  ListRow,
  PageHeader,
  RowActionsMenu,
  SectionCard,
  StatusBadge,
  appButton,
  type ColumnDef,
  type RowAction,
} from "@/components/app";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { createStaffApiTokenAction, revokeStaffApiTokenAction } from "@/lib/actions/admin/staff-api-tokens";
import { formatDate, formatDateTime } from "@/lib/format/date";
import { toast } from "@/lib/toast";

export interface ApiTokenRow {
  id: string;
  name: string;
  prefix: string;
  scopes: Array<{ value: string; label: string; effective: boolean }>;
  ipAllowlist: string[];
  rateLimitPerMinute: number;
  expiresAt: string | null;
  lastUsedAt: string | null;
  lastUsedIp: string | null;
  createdAt: string;
  state: "active" | "expired" | "revoked";
}

export interface ScopeOption {
  value: string;
  label: string;
  endpoints: string[];
}

const selectClass =
  "flex h-11 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 md:h-9";

const EXPIRY_OPTIONS = [
  { value: "30", label: "30 gün" },
  { value: "90", label: "90 gün" },
  { value: "180", label: "180 gün" },
  { value: "365", label: "1 yıl" },
  { value: "", label: "Süresiz (önerilmez)" },
];

export function TokenStateBadge({ state }: { state: ApiTokenRow["state"] }) {
  if (state === "active") return <StatusBadge tone="success" label="Aktif" />;
  if (state === "expired") return <StatusBadge tone="warning" label="Süresi doldu" />;
  return <StatusBadge tone="muted" label="İptal edildi" />;
}

export function ApiTokensContent({ tokens, scopeOptions }: { tokens: ApiTokenRow[]; scopeOptions: ScopeOption[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [scopes, setScopes] = useState<string[]>([]);
  const [formError, setFormError] = useState<string>();
  const [created, setCreated] = useState<{ name: string; secret: string } | null>(null);

  const toggleScope = (value: string, checked: boolean) =>
    setScopes((current) => (checked ? [...new Set([...current, value])] : current.filter((scope) => scope !== value)));

  const onCreate = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const fd = new FormData(form);
    setFormError(undefined);
    start(async () => {
      const expires = String(fd.get("expiresInDays") ?? "");
      const result = await createStaffApiTokenAction({
        name: String(fd.get("name") ?? ""),
        scopes,
        ipAllowlist: String(fd.get("ipAllowlist") ?? ""),
        expiresInDays: expires ? Number(expires) : null,
        rateLimitPerMinute: Number(fd.get("rateLimitPerMinute") ?? 120),
      });
      if (result.success) {
        setCreated({ name: result.token.name, secret: result.secret });
        setScopes([]);
        form.reset();
        router.refresh();
      } else {
        setFormError(result.error);
      }
    });
  };

  const revoke = (row: ApiTokenRow) => {
    if (!confirm(`"${row.name}" token'ı iptal edilsin mi? Bu token'ı kullanan otomasyonlar hemen çalışmayı bırakır.`)) return;
    start(async () => {
      const result = await revokeStaffApiTokenAction(row.id);
      if (result.success) {
        toast.success(result.message);
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  };

  const rowActions = (row: ApiTokenRow): RowAction[] => [
    {
      label: "İptal et",
      icon: <Trash2 aria-hidden />,
      destructive: true,
      disabledReason: row.state === "revoked" ? "İptal edilmiş" : undefined,
      onSelect: () => revoke(row),
    },
  ];

  const scopeSummary = (row: ApiTokenRow) => {
    const inactive = row.scopes.filter((scope) => !scope.effective).length;
    return (
      <span className="text-muted-foreground">
        {row.scopes.length} yetki
        {inactive > 0 ? <span className="text-amber-700 dark:text-amber-400"> ({inactive} etkisiz)</span> : null}
      </span>
    );
  };

  const columns: ColumnDef<ApiTokenRow>[] = [
    {
      accessorKey: "name",
      header: "Token",
      cell: ({ row }) => (
        <div className="min-w-0">
          <p className="truncate font-medium">{row.original.name}</p>
          <p className="font-mono text-xs text-muted-foreground">{row.original.prefix}…</p>
        </div>
      ),
    },
    {
      id: "scopes",
      header: "Yetkiler",
      enableSorting: false,
      cell: ({ row }) => (
        <div title={row.original.scopes.map((scope) => `${scope.value}${scope.effective ? "" : " (etkisiz)"}`).join("\n")}>
          {scopeSummary(row.original)}
        </div>
      ),
    },
    {
      id: "state",
      accessorFn: (r) => r.state,
      header: "Durum",
      cell: ({ row }) => <TokenStateBadge state={row.original.state} />,
    },
    {
      id: "expiresAt",
      accessorFn: (r) => r.expiresAt ?? "",
      header: "Bitiş",
      cell: ({ row }) => <span className="tabular-nums text-muted-foreground">{row.original.expiresAt ? formatDate(row.original.expiresAt) : "Süresiz"}</span>,
    },
    {
      id: "lastUsedAt",
      accessorFn: (r) => r.lastUsedAt ?? "",
      header: "Son kullanım",
      cell: ({ row }) => (
        <span className="tabular-nums text-muted-foreground">
          {row.original.lastUsedAt ? `${formatDateTime(row.original.lastUsedAt)} · ${row.original.lastUsedIp ?? "?"}` : "Kullanılmadı"}
        </span>
      ),
    },
    {
      id: "ip",
      header: "IP kısıtı",
      enableSorting: false,
      cell: ({ row }) => (
        <span className="font-mono text-xs text-muted-foreground">{row.original.ipAllowlist.length ? row.original.ipAllowlist.join(", ") : "Yok"}</span>
      ),
    },
    {
      id: "actions",
      header: "",
      enableSorting: false,
      cell: ({ row }) => <RowActionsMenu actions={rowActions(row.original)} />,
    },
  ];

  return (
    <>
      <PageHeader
        title="API token'ları"
        description="Otomasyon ve yapay zekâ ajanları için Admin API (/api/admin/v1) erişimi. Bir token, seçtiğiniz yetkilerin yalnızca sizin o anki rolünüzde de bulunanlarını kullanabilir; rolünüz değişirse token da daralır."
        actions={
          <Link href="/yonetim/api-tokenlari/dokumantasyon" className={appButton({ variant: "outline" })}>
            <BookOpen aria-hidden />
            Dokümantasyon
          </Link>
        }
      />

      {created ? (
        <SectionCard title="Yeni token" description={`"${created.name}" oluşturuldu. Bu değeri şimdi kopyalayın; tekrar gösterilmeyecek.`}>
          <div className="flex items-center gap-2 rounded-md border border-dashed p-3">
            <code className="min-w-0 flex-1 break-all font-mono text-sm">{created.secret}</code>
            <CopyButton value={created.secret} label="Token'ı kopyala" />
          </div>
          <p className="mt-3 flex items-start gap-2 text-xs text-muted-foreground">
            <TriangleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
            Token&apos;ı kod deposuna veya sohbet geçmişine koymayın; ortam değişkeni / gizli anahtar deposunda saklayın.
          </p>
          <button type="button" className={appButton({ variant: "ghost", size: "sm", className: "mt-3" })} onClick={() => setCreated(null)}>
            Kopyaladım, gizle
          </button>
        </SectionCard>
      ) : null}

      <SectionCard title="Token'larım" description={`${tokens.length} token`} flush>
        <DataTable
          framed={false}
          caption="API token'larım"
          columns={columns}
          data={tokens}
          pageSize={0}
          searchFn={(r, q) => r.name.toLocaleLowerCase("tr-TR").includes(q) || r.prefix.includes(q)}
          searchPlaceholder="Token adı ara…"
          mobileCard={(r) => (
            <ListRow
              title={r.name}
              subtitle={`${r.prefix}…`}
              trailing={<RowActionsMenu actions={rowActions(r)} />}
              meta={
                <>
                  <TokenStateBadge state={r.state} />
                  {scopeSummary(r)}
                  <span>{r.lastUsedAt ? `Son kullanım ${formatDate(r.lastUsedAt)}` : "Kullanılmadı"}</span>
                </>
              }
            />
          )}
          emptyState={<EmptyState compact icon={KeyRound} title="Henüz token yok" description="Aşağıdan ilk token'ınızı oluşturun." />}
        />
      </SectionCard>

      <SectionCard title="Yeni token oluştur" description="Ajana yalnızca işi için gereken yetkileri verin; okuma yetkileri çoğu izleme işi için yeterlidir.">
        <form onSubmit={onCreate} className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-3">
            <FormField label="Ad" htmlFor="token-name" required hint="Örn. “Destek ajanı” veya “n8n faturalama”">
              <Input id="token-name" name="name" required maxLength={80} autoComplete="off" className="h-11 md:h-9" />
            </FormField>
            <FormField label="Geçerlilik" htmlFor="token-expiry">
              <select id="token-expiry" name="expiresInDays" defaultValue="90" className={selectClass}>
                {EXPIRY_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </FormField>
            <FormField label="Dakikalık istek sınırı" htmlFor="token-rate" hint="1–1000">
              <Input id="token-rate" name="rateLimitPerMinute" type="number" min={1} max={1000} defaultValue={120} className="h-11 md:h-9" />
            </FormField>
          </div>

          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">Yetkiler (scope)</legend>
            <div className="flex flex-wrap gap-2">
              <button type="button" className={appButton({ variant: "outline", size: "sm" })} onClick={() => setScopes(scopeOptions.filter((o) => o.value.endsWith(".view")).map((o) => o.value))}>
                Yalnız okuma
              </button>
              <button type="button" className={appButton({ variant: "outline", size: "sm" })} onClick={() => setScopes(scopeOptions.map((o) => o.value))}>
                Tümü
              </button>
              <button type="button" className={appButton({ variant: "ghost", size: "sm" })} onClick={() => setScopes([])}>
                Temizle
              </button>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {scopeOptions.map((option) => (
                <label key={option.value} className="flex cursor-pointer items-start gap-3 rounded-md border p-3 text-sm has-[:checked]:bg-muted">
                  <input
                    type="checkbox"
                    className="mt-0.5 size-4 accent-foreground"
                    checked={scopes.includes(option.value)}
                    onChange={(event) => toggleScope(option.value, event.target.checked)}
                  />
                  <span className="min-w-0">
                    <span className="block font-medium">{option.label}</span>
                    <span className="block font-mono text-xs text-muted-foreground">{option.value}</span>
                    <span className="mt-1 block break-words text-xs text-muted-foreground">{option.endpoints.join(" · ")}</span>
                  </span>
                </label>
              ))}
            </div>
            {scopeOptions.length === 0 ? <p className="text-sm text-muted-foreground">Rolünüz hiçbir API ucuna erişim vermiyor.</p> : null}
          </fieldset>

          <FormField
            label="İzinli IP adresleri"
            htmlFor="token-ips"
            hint="Her satıra bir IP veya CIDR (örn. 203.0.113.10, 10.0.0.0/8, 2001:db8::/32). Boş bırakılırsa her adresten kullanılabilir."
          >
            <Textarea id="token-ips" name="ipAllowlist" rows={3} className="font-mono text-sm" placeholder="203.0.113.10" />
          </FormField>

          {formError ? (
            <p role="alert" className="text-sm text-red-600 dark:text-red-400">
              {formError}
            </p>
          ) : null}
          <button type="submit" disabled={pending || scopes.length === 0} className={appButton({ className: "w-full sm:w-auto" })}>
            <Plus aria-hidden />
            Token oluştur
          </button>
        </form>
      </SectionCard>
    </>
  );
}
