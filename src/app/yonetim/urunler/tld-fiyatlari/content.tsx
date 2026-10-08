"use client";

import { useMemo, useState, useTransition } from "react";
import { Check, Globe, Loader2, Pencil, RefreshCw } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  DataTable,
  EmptyState,
  FormField,
  ListRow,
  PageHeader,
  SectionCard,
  StatCard,
  StatGrid,
  StatusBadge,
  appButton,
  type ColumnDef,
} from "@/components/app";
import { CatalogDialog, SwitchField } from "@/components/admin-b/katalog";
import {
  applyTldSuggestionsAction,
  saveTldPricingRulesAction,
  syncFxRatesNowAction,
  updateTldCostAction,
} from "@/lib/actions/admin/tld-pricing";
import { formatDate } from "@/lib/format/date";
import { formatTRY } from "@/lib/format/price";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";

type Kind = "register" | "renew" | "transfer";
type Rounding = "none" | "x90" | "x99" | "whole";

interface PriceLine {
  cost: number | null;
  costTry: number | null;
  current: number;
  suggested: number | null;
  delta: number | null;
  currentMarginPercent: number | null;
}

export interface TldPriceRow {
  id: string;
  ext: string;
  isActive: boolean;
  costCurrency: string;
  rate: number | null;
  rateDay: string | null;
  changed: boolean;
  lines: Record<Kind, PriceLine>;
}

interface RateView {
  currency: string;
  date: string | null;
  buying: number | null;
  selling: number | null;
  banknoteSelling: number | null;
}

interface RulesView {
  marginPercent: number;
  marginFixedTry: number;
  rounding: Rounding;
  autoApply: boolean;
  updatedAt: string | null;
}

const KINDS: Array<{ kind: Kind; label: string }> = [
  { kind: "register", label: "Kayıt" },
  { kind: "renew", label: "Yenileme" },
  { kind: "transfer", label: "Transfer" },
];

const ROUNDING_OPTIONS: Array<{ value: Rounding; label: string }> = [
  { value: "x90", label: ",90 ile bitir (yukarı)" },
  { value: "x99", label: ",99 ile bitir (yukarı)" },
  { value: "whole", label: "Tam liraya yuvarla (yukarı)" },
  { value: "none", label: "Kuruşa yuvarla" },
];

const tl = (n: number) => formatTRY(n, { keepDecimals: true });
const rateText = (n: number | null) => (n === null ? "—" : n.toLocaleString("tr-TR", { minimumFractionDigits: 4, maximumFractionDigits: 4 }));
const costText = (n: number | null, currency: string) =>
  n === null ? "—" : `${n.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 4 })} ${currency}`;

function PriceCell({ line }: { line: PriceLine }) {
  const changes = line.suggested !== null && line.delta !== null && line.delta !== 0;
  return (
    <div className="text-right tabular-nums">
      <div className={cn("whitespace-nowrap", changes ? "text-muted-foreground line-through decoration-1" : "font-medium")}>
        {tl(line.current)}
      </div>
      {changes ? (
        <div className="whitespace-nowrap font-medium">
          {tl(line.suggested!)}{" "}
          <span className="font-mono text-[11px] text-muted-foreground">
            {line.delta! > 0 ? "+" : ""}
            {tl(line.delta!)}
          </span>
        </div>
      ) : line.suggested === null ? (
        <div className="whitespace-nowrap text-[11px] text-muted-foreground">öneri yok</div>
      ) : null}
      {line.cost !== null && line.costTry !== null ? (
        <div className="whitespace-nowrap font-mono text-[11px] text-muted-foreground">
          maliyet {tl(line.costTry)}
          {line.currentMarginPercent !== null ? ` · marj %${line.currentMarginPercent.toLocaleString("tr-TR")}` : ""}
        </div>
      ) : null}
    </div>
  );
}

export function TldPricingContent({
  rows,
  rates,
  rateDay,
  rules,
}: {
  rows: TldPriceRow[];
  rates: RateView[];
  rateDay: string | null;
  rules: RulesView;
}) {
  const [isPending, startTransition] = useTransition();
  const [form, setForm] = useState({
    marginPercent: String(rules.marginPercent).replace(".", ","),
    marginFixedTry: String(rules.marginFixedTry).replace(".", ","),
    rounding: rules.rounding,
    autoApply: rules.autoApply,
  });
  const [confirm, setConfirm] = useState<{ ids: string[] | undefined; rows: TldPriceRow[] } | null>(null);
  const [editing, setEditing] = useState<TldPriceRow | null>(null);
  const [costForm, setCostForm] = useState({ costRegister: "", costRenew: "", costTransfer: "", costCurrency: "USD" });

  const changedRows = useMemo(() => rows.filter((r) => r.changed), [rows]);
  const withoutCost = rows.filter((r) => KINDS.every(({ kind }) => r.lines[kind].cost === null)).length;

  const saveRules = () =>
    startTransition(async () => {
      const result = await saveTldPricingRulesAction(form);
      if (result.success) toast.success("Marj kuralı kaydedildi");
      else toast.error(result.error);
    });

  const syncRates = () =>
    startTransition(async () => {
      const result = await syncFxRatesNowAction();
      if (result.success) toast.success(result.message);
      else toast.error(result.error);
    });

  const apply = () => {
    if (!confirm) return;
    startTransition(async () => {
      const result = await applyTldSuggestionsAction({ tldIds: confirm.ids, expectedRateDay: rateDay });
      if (result.success) {
        toast.success(`${result.applied} TLD fiyatı güncellendi`);
        setConfirm(null);
      } else {
        toast.error(result.error);
      }
    });
  };

  const openCostEditor = (row: TldPriceRow) => {
    const text = (n: number | null) => (n === null ? "" : String(n).replace(".", ","));
    setCostForm({
      costRegister: text(row.lines.register.cost),
      costRenew: text(row.lines.renew.cost),
      costTransfer: text(row.lines.transfer.cost),
      costCurrency: row.costCurrency,
    });
    setEditing(row);
  };

  const saveCost = () => {
    if (!editing) return;
    startTransition(async () => {
      const result = await updateTldCostAction({
        id: editing.id,
        ...costForm,
        costCurrency: costForm.costCurrency as "USD" | "EUR" | "GBP" | "TRY",
      });
      if (result.success) {
        toast.success(`${editing.ext} maliyeti kaydedildi`);
        setEditing(null);
      } else {
        toast.error(result.error);
      }
    });
  };

  const columns: ColumnDef<TldPriceRow>[] = [
    {
      accessorKey: "ext",
      header: "Uzantı",
      cell: ({ row }) => (
        <div className="space-y-1">
          <div className="font-mono font-medium">{row.original.ext}</div>
          {!row.original.isActive ? <StatusBadge tone="muted" label="Satışta değil" size="sm" /> : null}
        </div>
      ),
    },
    {
      id: "rate",
      accessorFn: (r) => r.rate ?? 0,
      header: "Kur",
      meta: { align: "right" },
      cell: ({ row }) => (
        <div className="text-right tabular-nums">
          <div className="font-mono text-xs">{row.original.costCurrency}</div>
          <div className="whitespace-nowrap text-muted-foreground">
            {row.original.costCurrency === "TRY" ? "—" : rateText(row.original.rate)}
          </div>
        </div>
      ),
    },
    ...KINDS.map<ColumnDef<TldPriceRow>>(({ kind, label }) => ({
      id: kind,
      accessorFn: (r) => r.lines[kind].current,
      header: label,
      meta: { align: "right" },
      cell: ({ row }) => <PriceCell line={row.original.lines[kind]} />,
    })),
  ];

  return (
    <>
      <PageHeader
        title="TLD fiyatları"
        description="Registrar maliyeti × TCMB döviz satış kuru + marj kuralı ile önerilen satış fiyatları. Fiyatlar KDV hariçtir; siz uygulamadıkça değişmez."
        meta={
          <span className="font-mono text-[11px] uppercase tracking-[0.12em]">
            Kur tarihi · {rateDay ? formatDate(`${rateDay}T12:00:00Z`) : "kur yok"}
          </span>
        }
        actions={
          <>
            <button type="button" className={appButton({ variant: "outline" })} onClick={syncRates} disabled={isPending}>
              <RefreshCw aria-hidden />
              Kurları güncelle
            </button>
            <button
              type="button"
              className={appButton()}
              disabled={isPending || changedRows.length === 0}
              onClick={() => setConfirm({ ids: undefined, rows: changedRows })}
            >
              <Check aria-hidden />
              Önerileri uygula ({changedRows.length})
            </button>
          </>
        }
      />

      <StatGrid columns={4}>
        {rates.map((rate) => (
          <StatCard
            key={rate.currency}
            label={`${rate.currency} döviz satış`}
            value={rate.selling === null ? "—" : `${rateText(rate.selling)} ₺`}
            hint={
              rate.date
                ? `Alış ${rateText(rate.buying)} · Efektif satış ${rateText(rate.banknoteSelling)} · ${formatDate(`${rate.date}T12:00:00Z`)}`
                : "Henüz kur alınmadı"
            }
          />
        ))}
        <StatCard
          label="Maliyeti olmayan TLD"
          value={withoutCost.toLocaleString("tr-TR")}
          hint="Öneri üretilemez"
          tone={withoutCost > 0 ? "warning" : undefined}
        />
      </StatGrid>

      <SectionCard
        title="Marj kuralı"
        description="Öneri = maliyet × kur × (1 + yüzde) + sabit tutar, seçilen bitişe yukarı yuvarlanır."
        footer={
          <div className="flex justify-end">
            <button type="button" className={appButton()} onClick={saveRules} disabled={isPending}>
              {isPending ? <Loader2 aria-hidden className="animate-spin" /> : null}
              Kuralı kaydet
            </button>
          </div>
        }
      >
        <div className="grid gap-4 md:grid-cols-3">
          <FormField label="Marj (%)" htmlFor="marginPercent" hint="Kur dönüşümünden sonra eklenir.">
            <Input
              id="marginPercent"
              inputMode="decimal"
              value={form.marginPercent}
              onChange={(e) => setForm((f) => ({ ...f, marginPercent: e.target.value }))}
            />
          </FormField>
          <FormField label="Sabit marj (₺)" htmlFor="marginFixedTry" hint="Her fiyata eklenen tutar, KDV hariç.">
            <Input
              id="marginFixedTry"
              inputMode="decimal"
              value={form.marginFixedTry}
              onChange={(e) => setForm((f) => ({ ...f, marginFixedTry: e.target.value }))}
            />
          </FormField>
          <FormField label="Yuvarlama" htmlFor="rounding">
            <Select value={form.rounding} onValueChange={(v) => setForm((f) => ({ ...f, rounding: v as Rounding }))}>
              <SelectTrigger id="rounding">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ROUNDING_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
        </div>
        <div className="mt-4">
          <SwitchField
            id="autoApply"
            label="Önerileri her gün otomatik uygula"
            description="Varsayılan kapalı. Açıkken günlük kur senkronundan sonra öneriler fiyatlara yazılır ve aktivite kaydına işlenir; %30'dan büyük değişimler atlanır."
            checked={form.autoApply}
            onCheckedChange={(checked) => setForm((f) => ({ ...f, autoApply: checked }))}
          />
        </div>
      </SectionCard>

      <DataTable
        caption="TLD fiyat önerileri"
        columns={columns}
        data={rows}
        pageSize={25}
        searchFn={(r, q) => r.ext.toLocaleLowerCase("tr-TR").includes(q)}
        searchPlaceholder="Uzantı ara…"
        filters={[
          {
            id: "state",
            label: "Durum",
            options: [
              { value: "changed", label: "Değişecek" },
              { value: "nocost", label: "Maliyet yok" },
              { value: "same", label: "Güncel" },
            ],
            getValue: (r) =>
              r.changed ? "changed" : KINDS.every(({ kind }) => r.lines[kind].cost === null) ? "nocost" : "same",
          },
        ]}
        getRowId={(r) => r.id}
        rowActions={(r) => [
          { label: "Maliyeti düzenle", icon: <Pencil />, onSelect: () => openCostEditor(r) },
          r.changed
            ? { label: "Öneriyi uygula", icon: <Check />, onSelect: () => setConfirm({ ids: [r.id], rows: [r] }) }
            : { label: "Öneriyi uygula", icon: <Check />, disabledReason: "Fiyat zaten öneriyle aynı veya maliyet yok" },
        ]}
        mobileCard={(r) => (
          <ListRow
            title={<span className="font-mono">{r.ext}</span>}
            subtitle={`${r.costCurrency}${r.rate !== null && r.costCurrency !== "TRY" ? ` · kur ${rateText(r.rate)}` : ""}`}
            trailing={
              r.lines.register.suggested !== null && r.lines.register.delta
                ? `${tl(r.lines.register.current)} → ${tl(r.lines.register.suggested)}`
                : tl(r.lines.register.current)
            }
            meta={KINDS.slice(1).map(({ kind, label }) => (
              <span key={kind}>
                {label} {tl(r.lines[kind].current)}
                {r.lines[kind].suggested !== null && r.lines[kind].delta ? ` → ${tl(r.lines[kind].suggested!)}` : ""}
              </span>
            ))}
          />
        )}
        emptyState={<EmptyState icon={Globe} title="Henüz TLD yok" description="Registrar entegrasyonundan maliyetleri içe aktarın veya alan adı uzantısı ekleyin." />}
      />

      <CatalogDialog
        open={confirm !== null}
        onOpenChange={(open) => !open && setConfirm(null)}
        title="Önerilen fiyatlar uygulansın mı?"
        description={`${confirm?.rows.length ?? 0} uzantının satış fiyatı değişecek. Kur tarihi: ${rateDay ? formatDate(`${rateDay}T12:00:00Z`) : "—"}. Değişiklik aktivite kaydına yazılır.`}
        size="lg"
        footer={
          <>
            <button type="button" className={appButton({ variant: "outline" })} onClick={() => setConfirm(null)} disabled={isPending}>
              Vazgeç
            </button>
            <button type="button" className={appButton()} onClick={apply} disabled={isPending}>
              {isPending ? <Loader2 aria-hidden className="animate-spin" /> : <Check aria-hidden />}
              Fiyatları uygula
            </button>
          </>
        }
      >
        <ul className="divide-y text-sm">
          {confirm?.rows.slice(0, 50).map((r) => (
            <li key={r.id} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-2">
              <span className="font-mono font-medium">{r.ext}</span>
              <span className="flex flex-wrap gap-x-3 text-xs tabular-nums text-muted-foreground">
                {KINDS.map(({ kind, label }) => {
                  const line = r.lines[kind];
                  if (line.suggested === null || !line.delta) return null;
                  return (
                    <span key={kind}>
                      {label}: {tl(line.current)} → <span className="text-foreground">{tl(line.suggested)}</span>
                    </span>
                  );
                })}
              </span>
            </li>
          ))}
        </ul>
        {confirm && confirm.rows.length > 50 ? (
          <p className="pt-2 text-xs text-muted-foreground">ve {confirm.rows.length - 50} uzantı daha…</p>
        ) : null}
      </CatalogDialog>

      <CatalogDialog
        open={editing !== null}
        onOpenChange={(open) => !open && setEditing(null)}
        title={<>Maliyet · <span className="font-mono">{editing?.ext}</span></>}
        description="Registrar'ın yıllık maliyeti. Boş bırakılan alan için öneri üretilmez."
        footer={
          <>
            <button type="button" className={appButton({ variant: "outline" })} onClick={() => setEditing(null)} disabled={isPending}>
              Vazgeç
            </button>
            <button type="button" className={appButton()} onClick={saveCost} disabled={isPending}>
              Kaydet
            </button>
          </>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Para birimi" htmlFor="costCurrency">
            <Select value={costForm.costCurrency} onValueChange={(v) => setCostForm((f) => ({ ...f, costCurrency: v }))}>
              <SelectTrigger id="costCurrency">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {["USD", "EUR", "GBP", "TRY"].map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
          {(
            [
              ["costRegister", "Kayıt maliyeti"],
              ["costRenew", "Yenileme maliyeti"],
              ["costTransfer", "Transfer maliyeti"],
            ] as const
          ).map(([key, label]) => (
            <FormField key={key} label={label} htmlFor={key}>
              <Input
                id={key}
                inputMode="decimal"
                value={costForm[key]}
                onChange={(e) => setCostForm((f) => ({ ...f, [key]: e.target.value }))}
              />
            </FormField>
          ))}
        </div>
      </CatalogDialog>
    </>
  );
}
