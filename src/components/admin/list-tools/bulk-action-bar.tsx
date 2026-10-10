"use client";

import * as React from "react";
import { AlertTriangle, Loader2, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FormField, appButton } from "@/components/app";
import type { BulkResult } from "@/lib/admin/bulk";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";

const num = (n: number) => n.toLocaleString("tr-TR");

export type BulkActionInput =
  | { kind: "text"; label: string; placeholder?: string; defaultValue?: string; required?: boolean }
  | { kind: "select"; label: string; options: { value: string; label: string }[]; required?: boolean };

/** A bulk version of an existing single-row action. */
export type BulkActionDef<T> = {
  id: string;
  label: string;
  icon?: React.ReactNode;
  destructive?: boolean;
  /** Rows the single action accepts; the others are left out (and counted in the dialog). */
  appliesTo?: (row: T) => boolean;
  /** "3 faturaya hatırlatma gönderilsin mi?" */
  confirmTitle: (count: number) => string;
  confirmDescription?: string;
  confirmLabel?: string;
  input?: BulkActionInput;
  run: (ids: string[], input: string) => Promise<BulkResult>;
  /** "3 faturaya hatırlatma gönderildi" */
  successText: (count: number) => string;
};

type Outcome = { action: string; result: BulkResult; labels: Map<string, string> };

/**
 * Bar shown above a table while rows are selected: count, select-all /
 * clear, and one button per bulk action. Every action asks for confirmation
 * with the number of rows, then reports partial failures by row.
 */
export function BulkActionBar<T>({
  selectedRows,
  filteredCount,
  noun,
  actions,
  getId,
  getLabel,
  onSelectAll,
  onClear,
  onDone,
}: {
  selectedRows: T[];
  /** Rows matching the current search + filters (on this server page). */
  filteredCount: number;
  /** "fatura", "hizmet"… */
  noun: string;
  actions: BulkActionDef<T>[];
  getId: (row: T) => string;
  getLabel: (row: T) => string;
  onSelectAll: () => void;
  onClear: () => void;
  /** After a run: keep the failed rows selected, refresh data. */
  onDone: (failedIds: string[]) => void;
}) {
  const [active, setActive] = React.useState<BulkActionDef<T> | null>(null);
  const [input, setInput] = React.useState("");
  const [running, setRunning] = React.useState(false);
  const [outcome, setOutcome] = React.useState<Outcome | null>(null);

  const count = selectedRows.length;
  const eligible = active ? selectedRows.filter((r) => active.appliesTo?.(r) ?? true) : [];
  const skipped = count - eligible.length;

  const open = (action: BulkActionDef<T>) => {
    setActive(action);
    setOutcome(null);
    setInput(action.input?.kind === "text" ? (action.input.defaultValue ?? "") : "");
  };
  const close = () => {
    if (running) return;
    setActive(null);
    setOutcome(null);
  };

  const confirm = async () => {
    if (!active || running || eligible.length === 0) return;
    if (active.input?.required !== false && active.input && !input.trim()) return;
    setRunning(true);
    const labels = new Map(eligible.map((r) => [getId(r), getLabel(r)]));
    let result: BulkResult;
    try {
      result = await active.run(eligible.map(getId), input.trim());
    } catch {
      result = { success: false, total: eligible.length, succeeded: 0, failed: [], error: "İşlem tamamlanamadı. Bağlantınızı kontrol edip tekrar deneyin." };
    }
    setRunning(false);

    if (result.error) {
      toast.error(result.error);
      return;
    }
    onDone(result.failed.map((f) => f.id));
    if (result.failed.length === 0) {
      toast.success(active.successText(result.succeeded));
      setActive(null);
      return;
    }
    // Partial failure: keep the dialog open with the per-row errors.
    setOutcome({ action: active.label, result, labels });
  };

  const inputMissing = Boolean(active?.input && active.input.required !== false && !input.trim());

  return (
    <div
      role="region"
      aria-label="Toplu işlemler"
      className="flex flex-col gap-2 border-b bg-muted/40 px-3 py-2.5 sm:flex-row sm:flex-wrap sm:items-center"
    >
      <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm" aria-live="polite">
        <span className="font-medium tabular-nums">
          {num(count)} {noun} seçildi
        </span>
        {count < filteredCount ? (
          <button type="button" onClick={onSelectAll} className="text-[13px] underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            Listelenen {num(filteredCount)} kaydın tümünü seç
          </button>
        ) : null}
        <button
          type="button"
          onClick={onClear}
          className="inline-flex items-center gap-1 text-[13px] text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <X aria-hidden className="size-3.5" />
          Seçimi temizle
        </button>
      </p>
      <div className="flex flex-wrap gap-2 sm:ml-auto">
        {actions.map((action) => (
          <button
            key={action.id}
            type="button"
            onClick={() => open(action)}
            className={appButton({ variant: action.destructive ? "destructive" : "outline", size: "sm" })}
          >
            {action.icon}
            {action.label}
          </button>
        ))}
      </div>

      <Dialog open={active !== null} onOpenChange={(o) => (!o ? close() : undefined)}>
        <DialogContent className="max-w-md">
          {active && !outcome ? (
            <>
              <DialogHeader>
                <DialogTitle>{active.confirmTitle(eligible.length)}</DialogTitle>
                <DialogDescription>
                  {active.confirmDescription ?? "İşlem her kayıt için ayrı ayrı uygulanır ve aktivite kaydına yazılır."}
                </DialogDescription>
              </DialogHeader>
              {skipped > 0 ? (
                <p className="flex items-start gap-2 rounded-md border border-dashed px-3 py-2 text-sm text-muted-foreground">
                  <AlertTriangle aria-hidden className="mt-0.5 size-4 shrink-0" />
                  Seçilen {num(count)} kaydın {num(skipped)} tanesi bu işleme uygun değil ve atlanacak.
                </p>
              ) : null}
              {active.input ? (
                <FormField label={active.input.label} htmlFor="bulk-input" required={active.input.required !== false}>
                  {active.input.kind === "text" ? (
                    <input
                      id="bulk-input"
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      placeholder={active.input.placeholder}
                      maxLength={500}
                      className="h-11 w-full rounded-md border bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:h-9"
                    />
                  ) : (
                    <select
                      id="bulk-input"
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      className="h-11 w-full rounded-md border bg-background px-2.5 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:h-9"
                    >
                      <option value="">Seçin…</option>
                      {active.input.options.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  )}
                </FormField>
              ) : null}
              <DialogFooter className="gap-2 sm:gap-0">
                <button type="button" onClick={close} disabled={running} className={appButton({ variant: "outline" })}>
                  Vazgeç
                </button>
                <button
                  type="button"
                  onClick={() => void confirm()}
                  disabled={running || eligible.length === 0 || inputMissing}
                  className={appButton({ variant: active.destructive ? "destructive" : "primary" })}
                >
                  {running ? <Loader2 aria-hidden className="animate-spin" /> : active.icon}
                  {running ? "Uygulanıyor…" : `${active.confirmLabel ?? active.label} (${num(eligible.length)})`}
                </button>
              </DialogFooter>
            </>
          ) : null}
          {outcome ? (
            <>
              <DialogHeader>
                <DialogTitle>{outcome.action}: kısmen tamamlandı</DialogTitle>
                <DialogDescription>
                  {num(outcome.result.succeeded)} kayıt işlendi, {num(outcome.result.failed.length)} kayıt işlenemedi. İşlenemeyen
                  kayıtlar seçili bırakıldı.
                </DialogDescription>
              </DialogHeader>
              <ul className="max-h-64 divide-y overflow-y-auto rounded-md border text-sm">
                {outcome.result.failed.map((f) => (
                  <li key={f.id} className="flex flex-col gap-0.5 px-3 py-2">
                    <span className={cn("font-medium", "font-mono text-[13px]")}>{outcome.labels.get(f.id) ?? f.id}</span>
                    <span className="text-muted-foreground">{f.error}</span>
                  </li>
                ))}
              </ul>
              <DialogFooter>
                <button type="button" onClick={close} className={appButton()}>
                  Tamam
                </button>
              </DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
