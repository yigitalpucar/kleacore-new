"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Download } from "lucide-react";
import { appButton, type DataTableProps } from "@/components/app";
import type { SavedFilterItem } from "@/lib/actions/admin/saved-filters";
import {
  listViewToParams,
  parseListView,
  type AdminListKey,
  type ListCapabilities,
  type ListView,
} from "@/lib/admin/list-views";
import { BulkActionBar, type BulkActionDef } from "./bulk-action-bar";
import { SavedViewsMenu } from "./saved-views-menu";

export type { BulkActionDef } from "./bulk-action-bar";

type AdminListOptions<T> = {
  list: AdminListKey;
  /** Export scope of this page (see the export route's specs), e.g. "overdue". */
  scope?: string;
  /** Filter ids of the table (for the URL / saved views / export). */
  filterIds: string[];
  /** Initial filter values when the URL has none (e.g. ?status= link filters). */
  filterDefaults?: Record<string, string>;
  getId: (row: T) => string;
  /** Row name in confirmations and failure lists ("FTR-2026-0001"). */
  getLabel: (row: T) => string;
  /** "fatura", "hizmet"… */
  noun: string;
  /** All bulk actions of the list; only those in `capabilities.bulk` are shown. */
  actions?: BulkActionDef<T>[];
  capabilities?: ListCapabilities;
};

type ControlledTableProps<T> = Pick<
  DataTableProps<T>,
  | "selection"
  | "query"
  | "onQueryChange"
  | "filterValues"
  | "onFilterValuesChange"
  | "onFilteredChange"
  | "getRowId"
  | "banner"
>;

function sameRows<T>(a: T[], b: T[]) {
  return a.length === b.length && a.every((row, i) => row === b[i]);
}

/**
 * Admin list tools for a DataTable (UI3 item 11): multi-select + bulk
 * action bar, URL-synced search/filters, saved views and CSV export of the
 * filtered view. Spread `tableProps` on the DataTable and render `toolbar`
 * in its toolbar slot.
 */
export function useAdminList<T>({
  list,
  scope = "all",
  filterIds,
  filterDefaults = {},
  getId,
  getLabel,
  noun,
  actions = [],
  capabilities = { bulk: [], export: false },
}: AdminListOptions<T>): { tableProps: ControlledTableProps<T>; toolbar: React.ReactNode } {
  const router = useRouter();
  const pathname = usePathname() ?? "";
  const searchParams = useSearchParams();
  const filterKey = filterIds.join(",");

  const [view, setView] = React.useState<ListView>(() =>
    parseListView(new URLSearchParams(searchParams?.toString() ?? ""), filterIds, filterDefaults)
  );
  const [selected, setSelected] = React.useState<string[]>([]);
  const [filtered, setFiltered] = React.useState<T[]>([]);

  // Keep the URL in step (shareable, survives reload) without a server round trip.
  React.useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    for (const key of [...sp.keys()]) if (key === "q" || key.startsWith("f_")) sp.delete(key);
    for (const [key, value] of listViewToParams(view)) sp.set(key, value);
    const qs = sp.toString();
    const next = qs ? `${pathname}?${qs}` : pathname;
    if (next !== `${window.location.pathname}${window.location.search}`) window.history.replaceState(null, "", next);
  }, [view, pathname]);

  const applySaved = React.useCallback(
    (item: SavedFilterItem) => {
      if (item.path !== pathname) {
        router.push(item.params ? `${item.path}?${item.params}` : item.path);
        return;
      }
      setView(parseListView(new URLSearchParams(item.params), filterKey ? filterKey.split(",") : [], filterDefaults));
      setSelected([]);
    },
    // filterDefaults is a literal per render; its values only matter on apply.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [pathname, router, filterKey]
  );

  const allowedActions = actions.filter((a) => capabilities.bulk.includes(a.id));
  const filteredIds = React.useMemo(() => new Set(filtered.map(getId)), [filtered, getId]);
  // Rows hidden by a filter change or gone after a refresh are not acted on.
  const effectiveSelected = React.useMemo(() => selected.filter((id) => filteredIds.has(id)), [selected, filteredIds]);
  const selectedRows = React.useMemo(() => {
    const set = new Set(effectiveSelected);
    return filtered.filter((r) => set.has(getId(r)));
  }, [filtered, effectiveSelected, getId]);

  const exportHref = React.useMemo(() => {
    const sp = listViewToParams(view);
    if (scope !== "all") sp.set("scope", scope);
    const qs = sp.toString();
    return `/api/admin/export/${list}${qs ? `?${qs}` : ""}`;
  }, [list, scope, view]);

  const banner =
    allowedActions.length && selectedRows.length ? (
      <BulkActionBar
        selectedRows={selectedRows}
        filteredCount={filtered.length}
        noun={noun}
        actions={allowedActions}
        getId={getId}
        getLabel={getLabel}
        onSelectAll={() => setSelected(filtered.map(getId))}
        onClear={() => setSelected([])}
        onDone={(failedIds) => {
          setSelected(failedIds);
          router.refresh();
        }}
      />
    ) : null;

  const toolbar = (
    <div className="flex flex-wrap gap-2">
      <SavedViewsMenu list={list} path={pathname} view={view} filterIds={filterIds} onApply={applySaved} />
      {capabilities.export ? (
        <a
          href={exportHref}
          download
          className={appButton({ variant: "outline", size: "sm" })}
          title="Arama ve filtrelere uyan kayıtların tamamı (tüm sayfalar), Excel uyumlu CSV"
        >
          <Download aria-hidden />
          CSV
        </a>
      ) : null}
    </div>
  );

  return {
    tableProps: {
      getRowId: getId,
      query: view.q,
      onQueryChange: (q) => setView((v) => ({ ...v, q })),
      filterValues: view.filters,
      onFilterValuesChange: (filters) => setView((v) => ({ ...v, filters })),
      // Tables often pass inline filter arrays, so the filtered list is a new
      // array on every render; keep the old one when the rows are the same.
      onFilteredChange: (rows) => setFiltered((prev) => (sameRows(prev, rows) ? prev : rows)),
      selection: allowedActions.length
        ? { selected: effectiveSelected, onChange: setSelected, rowLabel: (row) => `${getLabel(row)} seç` }
        : undefined,
      banner,
    },
    toolbar,
  };
}
