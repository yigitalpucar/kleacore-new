"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type RowData,
  type SortingState,
} from "@tanstack/react-table";
import {
  ArrowDown,
  ArrowUp,
  ChevronLeft,
  ChevronRight,
  ChevronsUpDown,
  MoreHorizontal,
  Search,
  X,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { appButton } from "./button-classes";

declare module "@tanstack/react-table" {
   
  interface ColumnMeta<TData extends RowData, TValue> {
    /** Applied to both th and td. */
    className?: string;
    headerClassName?: string;
    cellClassName?: string;
    align?: "left" | "right" | "center";
  }
}

export type { ColumnDef };

export type RowAction = {
  label: string;
  icon?: React.ReactNode;
  href?: string;
  onSelect?: () => void;
  /** Renders the item disabled with this reason (e.g. "Yakında"). */
  disabledReason?: string;
  destructive?: boolean;
  /** Separator above this item. */
  separator?: boolean;
};

export type DataTableFilter<T> = {
  id: string;
  label: string;
  options: { value: string; label: string }[];
  getValue: (row: T) => string | null | undefined;
  /** "tabs" (segmented, shows counts) or "select" (compact). Default tabs. */
  variant?: "tabs" | "select";
  /** Include an "all" option (default true, label "Tümü"). */
  allLabel?: string | false;
  defaultValue?: string;
};

export type DataTableProps<T> = {
  columns: ColumnDef<T, any>[];  
  data: T[];
  /** Enables the search box. Return true when the row matches the query (already lower-cased, tr-TR). */
  searchFn?: (row: T, query: string) => boolean;
  searchPlaceholder?: string;
  filters?: DataTableFilter<T>[];
  /** Extra controls on the right side of the toolbar. */
  toolbar?: React.ReactNode;
  /** Rows per page; 0 disables pagination. Default 10. */
  pageSize?: number;
  initialSort?: SortingState;
  /** Shown when `data` is empty. */
  emptyState?: React.ReactNode;
  /** Shown when filters/search leave no rows. */
  noResultsText?: string;
  /** Card renderer for < md screens. Without it the table scrolls inside its frame. */
  mobileCard?: (row: T) => React.ReactNode;
  /** Makes rows (and mobile cards) navigate on click. */
  rowHref?: (row: T) => string;
  rowActions?: (row: T) => RowAction[];
  getRowId?: (row: T) => string;
  /** sr-only caption for screen readers. */
  caption?: string;
  /** Wrap in a bordered card (default true). Set false inside a SectionCard flush. */
  framed?: boolean;
  className?: string;
  /**
   * Multi-select (bulk actions): adds a checkbox column (and a checkbox on
   * mobile cards). Ids come from `getRowId`, which is required with it.
   */
  selection?: DataTableSelection<T>;
  /** Controlled search text (saved views). Uncontrolled when omitted. */
  query?: string;
  onQueryChange?: (query: string) => void;
  /** Controlled filter values by filter id (saved views). */
  filterValues?: Record<string, string>;
  onFilterValuesChange?: (values: Record<string, string>) => void;
  /** Rows left after search + filters (all pages), e.g. for "select all" or export counts. */
  onFilteredChange?: (rows: T[]) => void;
  /** Rendered under the toolbar, above the rows (e.g. a bulk action bar). */
  banner?: React.ReactNode;
};

export type DataTableSelection<T> = {
  selected: readonly string[];
  onChange: (ids: string[]) => void;
  /** Accessible name of a row's checkbox, e.g. "FTR-001 seç". */
  rowLabel?: (row: T) => string;
};

const trLower = (s: string) => s.toLocaleLowerCase("tr-TR");

/**
 * Data table: search + filter toolbar, sortable headers, pagination, row
 * actions, empty state and a card layout on phones. Built on TanStack Table.
 * Filtering/search run on the client over `data`.
 */
export function DataTable<T>({
  columns,
  data,
  searchFn,
  searchPlaceholder = "Ara…",
  filters = [],
  toolbar,
  pageSize = 10,
  initialSort = [],
  emptyState,
  noResultsText = "Aramanızla eşleşen kayıt bulunamadı.",
  mobileCard,
  rowHref,
  rowActions,
  getRowId,
  caption,
  framed = true,
  className,
  selection,
  query: controlledQuery,
  onQueryChange,
  filterValues: controlledFilterValues,
  onFilterValuesChange,
  onFilteredChange,
  banner,
}: DataTableProps<T>) {
  const router = useRouter();
  const [uncontrolledQuery, setUncontrolledQuery] = React.useState("");
  const query = controlledQuery ?? uncontrolledQuery;
  const setQuery = (value: string) => {
    if (controlledQuery === undefined) setUncontrolledQuery(value);
    onQueryChange?.(value);
  };
  const [sorting, setSorting] = React.useState<SortingState>(initialSort);
  const [pagination, setPagination] = React.useState({ pageIndex: 0, pageSize: pageSize > 0 ? pageSize : 10 });
  const resetPage = () => setPagination((p) => ({ ...p, pageIndex: 0 }));
  const [uncontrolledFilterValues, setUncontrolledFilterValues] = React.useState<Record<string, string>>(() =>
    Object.fromEntries(filters.map((f) => [f.id, f.defaultValue ?? "all"]))
  );
  const filterValues = controlledFilterValues ?? uncontrolledFilterValues;
  const setFilterValue = (id: string, value: string) => {
    const next = { ...filterValues, [id]: value };
    if (controlledFilterValues === undefined) setUncontrolledFilterValues(next);
    onFilterValuesChange?.(next);
  };

  const filtered = React.useMemo(() => {
    const q = trLower(query.trim());
    return data.filter((row) => {
      for (const f of filters) {
        const v = filterValues[f.id] ?? "all";
        if (v !== "all" && f.getValue(row) !== v) return false;
      }
      if (q && searchFn && !searchFn(row, q)) return false;
      return true;
    });
  }, [data, filters, filterValues, query, searchFn]);

  React.useEffect(() => {
    onFilteredChange?.(filtered);
  }, [filtered, onFilteredChange]);

  const rowIdOf = React.useCallback((row: T) => (getRowId ? getRowId(row) : ""), [getRowId]);
  const selectedSet = React.useMemo(() => new Set(selection?.selected ?? []), [selection?.selected]);

  const allColumns = React.useMemo(() => {
    const base = selection ? [selectColumn(selection, selectedSet, rowIdOf), ...columns] : columns;
    if (!rowActions) return base;
    const actionsCol: ColumnDef<T, unknown> = {
      id: "__actions",
      header: () => <span className="sr-only">İşlemler</span>,
      enableSorting: false,
      meta: { align: "right", className: "w-12" },
      cell: ({ row }) => <RowActionsMenu actions={rowActions(row.original)} />,
    };
    return [...base, actionsCol];
  }, [columns, rowActions, selection, selectedSet, rowIdOf]);

  // TanStack's hook returns non-memoizable functions; this is expected.
  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data: filtered,
    columns: allColumns,
    state: { sorting, pagination },
    onSortingChange: setSorting,
    onPaginationChange: setPagination,
    getRowId: getRowId ? (row) => getRowId(row) : undefined,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    ...(pageSize > 0 ? { getPaginationRowModel: getPaginationRowModel() } : {}),
    autoResetPageIndex: false,
  });

  const rows = table.getRowModel().rows;
  const hasToolbar = Boolean(searchFn || filters.length || toolbar);
  const isEmpty = data.length === 0;
  const noResults = !isEmpty && filtered.length === 0;

  const onRowClick = (e: React.MouseEvent, row: T) => {
    if (!rowHref) return;
    const target = e.target as HTMLElement;
    if (target.closest("a,button,input,select,textarea,[role=menuitem],[data-no-row-click]")) return;
    const href = rowHref(row);
    if (e.metaKey || e.ctrlKey) window.open(href, "_blank");
    else router.push(href);
  };

  if (isEmpty && emptyState) {
    return <div className={className}>{emptyState}</div>;
  }

  const body = (
    <>
      {hasToolbar ? (
        <div className={cn("flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between", framed && "border-b p-3")}>
          <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
            {filters.map((f) => (
              <FilterControl
                key={f.id}
                filter={f}
                data={data}
                value={filterValues[f.id] ?? "all"}
                onChange={(v) => {
                  setFilterValue(f.id, v);
                  resetPage();
                }}
              />
            ))}
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            {searchFn ? (
              <div className="relative w-full sm:w-64">
                <Search aria-hidden className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="search"
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    resetPage();
                  }}
                  placeholder={searchPlaceholder}
                  aria-label={searchPlaceholder.replace(/…$/, "")}
                  className="h-11 w-full rounded-md border bg-background pl-9 pr-9 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:h-9 [&::-webkit-search-cancel-button]:hidden"
                />
                {query ? (
                  <button
                    type="button"
                    aria-label="Aramayı temizle"
                    onClick={() => setQuery("")}
                    className="absolute right-1 top-1/2 inline-flex size-9 -translate-y-1/2 items-center justify-center rounded text-muted-foreground hover:text-foreground md:size-7"
                  >
                    <X aria-hidden className="size-3.5" />
                  </button>
                ) : null}
              </div>
            ) : null}
            {toolbar}
          </div>
        </div>
      ) : null}

      {banner}

      {noResults || (isEmpty && !emptyState) ? (
        <p className="px-4 py-12 text-center text-sm text-muted-foreground">
          {isEmpty ? "Kayıt bulunmuyor." : noResultsText}
        </p>
      ) : (
        <>
          {/* Phones: cards */}
          {mobileCard ? (
            <ul className="divide-y md:hidden">
              {rows.map((row) => {
                const href = rowHref?.(row.original);
                const actions = rowActions?.(row.original);
                return (
                  <li key={row.id} className="relative flex items-start gap-2">
                    {selection ? (
                      <div className="py-2 pl-2">
                        <RowCheckbox
                          checked={selectedSet.has(rowIdOf(row.original))}
                          label={selection.rowLabel?.(row.original) ?? "Satırı seç"}
                          onChange={(checked) => toggleIds(selection, [rowIdOf(row.original)], checked)}
                          touch
                        />
                      </div>
                    ) : null}
                    {href ? (
                      <Link
                        href={href}
                        className="block min-w-0 flex-1 px-4 py-3.5 transition-colors hover:bg-muted/40 focus-visible:bg-muted/40 focus-visible:outline-none"
                      >
                        {mobileCard(row.original)}
                      </Link>
                    ) : (
                      <div className="min-w-0 flex-1 px-4 py-3.5">{mobileCard(row.original)}</div>
                    )}
                    {actions && actions.length ? (
                      <div className="py-2 pr-2">
                        <RowActionsMenu actions={actions} />
                      </div>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          ) : null}

          {/* md+: table (scrolls inside its frame if it must) */}
          <div className={cn("relative w-full overflow-x-auto", mobileCard && "hidden md:block")}>
            <table className="w-full caption-bottom text-sm">
              {caption ? <caption className="sr-only">{caption}</caption> : null}
              <thead>
                {table.getHeaderGroups().map((hg) => (
                  <tr key={hg.id} className="border-b bg-muted/30">
                    {hg.headers.map((header) => {
                      const meta = header.column.columnDef.meta;
                      const sorted = header.column.getIsSorted();
                      const canSort = header.column.getCanSort();
                      return (
                        <th
                          key={header.id}
                          scope="col"
                          aria-sort={sorted === "asc" ? "ascending" : sorted === "desc" ? "descending" : undefined}
                          className={cn(
                            "h-10 whitespace-nowrap px-4 text-left align-middle font-mono text-[11px] font-medium uppercase tracking-[0.1em] text-muted-foreground",
                            meta?.align === "right" && "text-right",
                            meta?.align === "center" && "text-center",
                            meta?.className,
                            meta?.headerClassName
                          )}
                        >
                          {header.isPlaceholder ? null : canSort ? (
                            <button
                              type="button"
                              onClick={header.column.getToggleSortingHandler()}
                              className={cn(
                                "-mx-1.5 inline-flex h-8 items-center gap-1 rounded px-1.5 uppercase hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                                sorted && "text-foreground"
                              )}
                            >
                              {flexRender(header.column.columnDef.header, header.getContext())}
                              {sorted === "asc" ? (
                                <ArrowUp aria-hidden className="size-3" />
                              ) : sorted === "desc" ? (
                                <ArrowDown aria-hidden className="size-3" />
                              ) : (
                                <ChevronsUpDown aria-hidden className="size-3 opacity-50" />
                              )}
                            </button>
                          ) : (
                            flexRender(header.column.columnDef.header, header.getContext())
                          )}
                        </th>
                      );
                    })}
                  </tr>
                ))}
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr
                    key={row.id}
                    onClick={rowHref ? (e) => onRowClick(e, row.original) : undefined}
                    aria-selected={selection ? selectedSet.has(rowIdOf(row.original)) : undefined}
                    className={cn(
                      "border-b transition-colors last:border-0 hover:bg-muted/40",
                      rowHref && "cursor-pointer",
                      selection && selectedSet.has(rowIdOf(row.original)) && "bg-muted/50"
                    )}
                  >
                    {row.getVisibleCells().map((cell) => {
                      const meta = cell.column.columnDef.meta;
                      return (
                        <td
                          key={cell.id}
                          className={cn(
                            "h-14 px-4 py-2.5 align-middle",
                            meta?.align === "right" && "text-right",
                            meta?.align === "center" && "text-center",
                            meta?.className,
                            meta?.cellClassName
                          )}
                        >
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {pageSize > 0 && filtered.length > pageSize ? (
            <Pagination
              framed={framed}
              pageIndex={table.getState().pagination.pageIndex}
              pageCount={table.getPageCount()}
              total={filtered.length}
              pageSize={pageSize}
              canPrev={table.getCanPreviousPage()}
              canNext={table.getCanNextPage()}
              onPrev={() => table.previousPage()}
              onNext={() => table.nextPage()}
            />
          ) : null}
        </>
      )}
    </>
  );

  if (!framed) return <div className={cn("space-y-3", className)}>{body}</div>;
  return (
    <div className={cn("min-w-0 overflow-hidden rounded-lg border bg-card text-card-foreground shadow-sm", className)}>
      {body}
    </div>
  );
}

function toggleIds<T>(selection: DataTableSelection<T>, ids: string[], checked: boolean) {
  const next = new Set(selection.selected);
  for (const id of ids) {
    if (checked) next.add(id);
    else next.delete(id);
  }
  selection.onChange([...next]);
}

function RowCheckbox({
  checked,
  indeterminate = false,
  label,
  onChange,
  touch = false,
}: {
  checked: boolean;
  indeterminate?: boolean;
  label: string;
  onChange: (checked: boolean) => void;
  /** 44px hit area (mobile cards). */
  touch?: boolean;
}) {
  const ref = React.useRef<HTMLInputElement>(null);
  React.useEffect(() => {
    if (ref.current) ref.current.indeterminate = indeterminate;
  }, [indeterminate]);
  return (
    <label
      data-no-row-click
      className={cn("inline-flex cursor-pointer items-center justify-center", touch ? "size-11" : "size-6")}
    >
      <input
        ref={ref}
        type="checkbox"
        checked={checked}
        aria-label={label}
        onChange={(e) => onChange(e.target.checked)}
        className="size-4 cursor-pointer rounded-[3px] border-input accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      />
    </label>
  );
}

function selectColumn<T>(
  selection: DataTableSelection<T>,
  selectedSet: Set<string>,
  rowIdOf: (row: T) => string
): ColumnDef<T, unknown> {
  return {
    id: "__select",
    enableSorting: false,
    meta: { className: "w-10 pr-0" },
    header: ({ table }) => {
      const ids = table.getRowModel().rows.map((r) => rowIdOf(r.original));
      const count = ids.filter((id) => selectedSet.has(id)).length;
      return (
        <RowCheckbox
          checked={ids.length > 0 && count === ids.length}
          indeterminate={count > 0 && count < ids.length}
          label="Bu sayfadaki tüm satırları seç"
          onChange={(checked) => toggleIds(selection, ids, checked)}
        />
      );
    },
    cell: ({ row }) => (
      <RowCheckbox
        checked={selectedSet.has(rowIdOf(row.original))}
        label={selection.rowLabel?.(row.original) ?? "Satırı seç"}
        onChange={(checked) => toggleIds(selection, [rowIdOf(row.original)], checked)}
      />
    ),
  };
}

function FilterControl<T>({
  filter,
  data,
  value,
  onChange,
}: {
  filter: DataTableFilter<T>;
  data: T[];
  value: string;
  onChange: (v: string) => void;
}) {
  const allLabel = filter.allLabel === undefined ? "Tümü" : filter.allLabel;
  const options = allLabel ? [{ value: "all", label: allLabel }, ...filter.options] : filter.options;

  if (filter.variant === "select") {
    return (
      <label className="flex items-center gap-2 text-sm">
        <span className="text-muted-foreground">{filter.label}</span>
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-11 rounded-md border bg-background px-2.5 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:h-9"
        >
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </label>
    );
  }

  const count = (v: string) =>
    v === "all" ? data.length : data.filter((row) => filter.getValue(row) === v).length;

  return (
    <div role="group" aria-label={filter.label} className="-mx-1 flex max-w-full gap-1 overflow-x-auto px-1 pb-0.5 [scrollbar-width:none]">
      {options.map((o) => {
        const active = value === o.value;
        return (
          <button
            key={o.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(o.value)}
            className={cn(
              "inline-flex h-10 shrink-0 items-center gap-1.5 rounded-md border px-3 text-[13px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:h-8 md:px-2.5",
              active
                ? "border-foreground bg-foreground text-background"
                : "border-transparent text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            {o.label}
            <span className={cn("font-mono text-[11px] tabular-nums", active ? "text-background/70" : "text-muted-foreground/70")}>
              {count(o.value)}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function Pagination({
  framed,
  pageIndex,
  pageCount,
  total,
  pageSize,
  canPrev,
  canNext,
  onPrev,
  onNext,
}: {
  framed: boolean;
  pageIndex: number;
  pageCount: number;
  total: number;
  pageSize: number;
  canPrev: boolean;
  canNext: boolean;
  onPrev: () => void;
  onNext: () => void;
}) {
  const from = pageIndex * pageSize + 1;
  const to = Math.min(total, (pageIndex + 1) * pageSize);
  return (
    <nav
      aria-label="Sayfalama"
      className={cn("flex items-center justify-between gap-3 text-sm", framed ? "border-t px-4 py-2.5" : "pt-1")}
    >
      <p className="text-muted-foreground">
        <span className="tabular-nums">
          {from}–{to}
        </span>{" "}
        / <span className="tabular-nums">{total}</span> kayıt
      </p>
      <div className="flex items-center gap-2">
        <span className="hidden text-muted-foreground sm:inline">
          Sayfa {pageIndex + 1} / {pageCount}
        </span>
        <button type="button" onClick={onPrev} disabled={!canPrev} aria-label="Önceki sayfa" className={appButton({ variant: "outline", size: "icon-sm" })}>
          <ChevronLeft aria-hidden />
        </button>
        <button type="button" onClick={onNext} disabled={!canNext} aria-label="Sonraki sayfa" className={appButton({ variant: "outline", size: "icon-sm" })}>
          <ChevronRight aria-hidden />
        </button>
      </div>
    </nav>
  );
}

/** "⋯" menu for a row. Exported for use outside DataTable. */
export function RowActionsMenu({ actions, label = "İşlemler" }: { actions: RowAction[]; label?: string }) {
  if (!actions.length) return null;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button type="button" aria-label={label} data-no-row-click className={appButton({ variant: "ghost", size: "icon-sm" })}>
          <MoreHorizontal aria-hidden />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-44">
        {actions.map((a, i) => (
          <React.Fragment key={`${a.label}-${i}`}>
            {a.separator && i > 0 ? <DropdownMenuSeparator /> : null}
            {a.disabledReason ? (
              <DropdownMenuItem disabled className="flex items-center gap-2 [&_svg]:size-4">
                {a.icon}
                <span className="flex-1">{a.label}</span>
                <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">{a.disabledReason}</span>
              </DropdownMenuItem>
            ) : a.href ? (
              <DropdownMenuItem asChild className={cn("cursor-pointer gap-2 [&_svg]:size-4", a.destructive && "text-red-600 dark:text-red-400")}>
                <Link href={a.href} className="flex items-center">
                  {a.icon}
                  {a.label}
                </Link>
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem
                onSelect={a.onSelect}
                className={cn("flex cursor-pointer items-center gap-2 [&_svg]:size-4", a.destructive && "text-red-600 dark:text-red-400")}
              >
                {a.icon}
                {a.label}
              </DropdownMenuItem>
            )}
          </React.Fragment>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
