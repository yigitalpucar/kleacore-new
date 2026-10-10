"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { CornerDownLeft, Loader2, Search, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import type { AppNavGroup } from "./app-shell";
import { flattenSections, matchesQuery, moveActive, type PaletteEntry, type PaletteSection } from "./command-palette-model";
import { ToneDot } from "./status-badge";
import { getStatusMeta, type StatusAudience, type StatusKind } from "./status-map";

export type AppSearchItem = { title: string; href: string; group?: string; icon?: LucideIcon; keywords?: string };

type RemoteGroup = {
  key: string;
  label: string;
  hits: Array<{
    id: string;
    title: string;
    subtitle?: string;
    href: string;
    status?: { kind: string; value: string };
    action?: { label: string; href: string };
  }>;
};

type RemoteState =
  | { status: "idle" }
  | { status: "loading"; query: string }
  | { status: "done"; query: string; groups: RemoteGroup[] }
  | { status: "error"; query: string; message: string };

const MIN_CHARS = 2;
const DEBOUNCE_MS = 250;
const PAGE_LIMIT_WHILE_SEARCHING = 6;

const iconBtn =
  "relative inline-flex size-11 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:size-9";

/**
 * ⌘K / Ctrl+K palette. Always: pages from the nav + `actions` (quick actions).
 * With `endpoint`: from 2 characters on it also searches records on the server
 * (debounced, aborted when the query changes, results grouped). The endpoint
 * answers `{ groups: RemoteGroup[] }` and does its own auth / scoping.
 */
export function AppCommandSearch({
  nav,
  extra = [],
  actions = [],
  endpoint,
  placeholder,
  statusAudience = "customer",
}: {
  nav: AppNavGroup[];
  /** Extra page links searched like nav items. */
  extra?: AppSearchItem[];
  /** Quick actions: listed first when the query is empty, searchable too. */
  actions?: AppSearchItem[];
  /** Server search endpoint (GET ?q=). Omit for a pages-only palette. */
  endpoint?: string;
  placeholder?: string;
  statusAudience?: StatusAudience;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [q, setQ] = React.useState("");
  const [active, setActive] = React.useState(0);
  const [remote, setRemote] = React.useState<RemoteState>({ status: "idle" });
  const [shortcut, setShortcut] = React.useState("⌘K");
  const inputRef = React.useRef<HTMLInputElement>(null);
  const listRef = React.useRef<HTMLDivElement>(null);
  const cache = React.useRef(new Map<string, RemoteGroup[]>());
  const listId = React.useId();

  const label = placeholder ?? (endpoint ? "Ara…" : "Sayfa ara…");

  React.useEffect(() => {
    if (!/Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent)) setShortcut("Ctrl K");
  }, []);

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // ------------------------------------------------------------ remote search
  const query = q.trim();
  React.useEffect(() => {
    if (!endpoint || !open || query.length < MIN_CHARS) {
      setRemote({ status: "idle" });
      return;
    }
    const cached = cache.current.get(query);
    if (cached) {
      setRemote({ status: "done", query, groups: cached });
      return;
    }
    setRemote({ status: "loading", query });
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      try {
        const res = await fetch(`${endpoint}?q=${encodeURIComponent(query)}`, {
          signal: controller.signal,
          headers: { accept: "application/json" },
        });
        if (res.status === 429) throw new Error("Çok hızlı arama yaptınız; birkaç saniye sonra tekrar deneyin.");
        if (!res.ok) throw new Error("Arama şu anda yapılamıyor.");
        const data = (await res.json()) as { groups?: RemoteGroup[] };
        const groups = data.groups ?? [];
        cache.current.set(query, groups);
        setRemote({ status: "done", query, groups });
      } catch (error) {
        if (controller.signal.aborted) return;
        setRemote({ status: "error", query, message: error instanceof Error ? error.message : "Arama yapılamadı." });
      }
    }, DEBOUNCE_MS);
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [endpoint, open, query]);

  // ---------------------------------------------------------------- sections
  const pages = React.useMemo(() => {
    const all: Array<PaletteEntry & { keywords?: string }> = [
      ...nav.flatMap((g) => g.items.map((i) => ({ key: `page:${i.href}`, title: i.title, href: i.href, hint: g.label }))),
      ...extra.map((i) => ({ key: `page:${i.href}`, title: i.title, href: i.href, hint: i.group, keywords: i.keywords })),
    ];
    const seen = new Set<string>();
    return all.filter((p) => (seen.has(p.key) ? false : (seen.add(p.key), true)));
  }, [nav, extra]);

  const icons = React.useMemo(() => {
    const map = new Map<string, LucideIcon>();
    for (const g of nav) for (const i of g.items) map.set(`page:${i.href}`, i.icon);
    for (const i of extra) if (i.icon) map.set(`page:${i.href}`, i.icon);
    for (const i of actions) if (i.icon) map.set(`action:${i.href}`, i.icon);
    return map;
  }, [nav, extra, actions]);

  const sections = React.useMemo<PaletteSection[]>(() => {
    const actionEntries = actions
      .filter((a) => matchesQuery(`${a.title} ${a.keywords ?? ""}`, query))
      .map((a) => ({ key: `action:${a.href}`, title: a.title, href: a.href, hint: a.group }));
    const pageEntries = pages
      .filter((p) => matchesQuery(`${p.title} ${p.hint ?? ""} ${p.keywords ?? ""}`, query))
      .map(({ keywords: _keywords, ...entry }) => entry);
    const out: PaletteSection[] = [];
    if (actionEntries.length) out.push({ key: "actions", label: "Hızlı işlemler", entries: actionEntries });
    if (remote.status === "done" && remote.query === query) {
      for (const g of remote.groups) {
        out.push({
          key: `remote:${g.key}`,
          label: g.label,
          entries: g.hits.map((h) => ({ key: `${g.key}:${h.id}`, title: h.title, subtitle: h.subtitle, href: h.href, status: h.status, action: h.action })),
        });
      }
    }
    out.push({
      key: "pages",
      label: "Sayfalar",
      entries: query ? pageEntries.slice(0, PAGE_LIMIT_WHILE_SEARCHING) : pageEntries,
    });
    return out;
  }, [actions, pages, query, remote]);

  const { visible, flat } = flattenSections(sections);

  React.useEffect(() => {
    setActive((a) => (a >= flat.length ? 0 : a));
  }, [flat.length]);

  React.useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-index="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active]);

  const go = (href: string) => {
    setOpen(false);
    setQ("");
    router.push(href);
  };

  const searching = endpoint && query.length >= MIN_CHARS;
  const loading = remote.status === "loading";
  const remoteEmpty = remote.status === "done" && remote.query === query && remote.groups.length === 0;

  let index = -1;

  return (
    <DialogPrimitive.Root
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) setQ("");
        setActive(0);
      }}
    >
      <DialogPrimitive.Trigger asChild>
        <button
          type="button"
          aria-label={`${label.replace(/…$/, "")} (${shortcut})`}
          aria-keyshortcuts="Meta+K Control+K"
          className={cn(
            iconBtn,
            "md:w-56 md:justify-start md:gap-2 md:border md:bg-background md:px-2.5 md:text-[13px] md:shadow-sm"
          )}
        >
          <Search aria-hidden className="size-4" />
          <span className="hidden flex-1 text-left md:inline">{label}</span>
          <kbd className="hidden rounded border bg-muted px-1.5 font-mono text-[10px] md:inline">{shortcut}</kbd>
        </button>
      </DialogPrimitive.Trigger>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/40 backdrop-blur-[2px] data-[state=open]:animate-in data-[state=open]:fade-in-0 motion-reduce:animate-none" />
        <DialogPrimitive.Content
          onOpenAutoFocus={(e) => {
            e.preventDefault();
            inputRef.current?.focus();
          }}
          className="fixed left-1/2 top-3 z-50 flex max-h-[calc(100dvh-1.5rem)] w-[calc(100vw-1.5rem)] max-w-xl -translate-x-1/2 flex-col overflow-hidden rounded-lg border bg-popover text-popover-foreground shadow-2xl data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 motion-reduce:animate-none sm:top-[12vh] sm:max-h-[70vh]"
        >
          <DialogPrimitive.Title className="sr-only">{endpoint ? "Ara" : "Sayfa ara"}</DialogPrimitive.Title>
          <DialogPrimitive.Description className="sr-only">
            {endpoint
              ? "Sayfa, işlem veya kayıt arayın. Kayıt araması için en az 2 karakter yazın; oklarla gezinip Enter ile açın."
              : "Gitmek istediğiniz sayfanın adını yazın."}
          </DialogPrimitive.Description>
          <div className="flex shrink-0 items-center gap-2 border-b px-3">
            {loading ? (
              <Loader2 aria-hidden className="size-4 animate-spin text-muted-foreground motion-reduce:animate-none" />
            ) : (
              <Search aria-hidden className="size-4 text-muted-foreground" />
            )}
            <input
              ref={inputRef}
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setActive(0);
              }}
              onKeyDown={(e) => {
                if (["ArrowDown", "ArrowUp"].includes(e.key) || (["Home", "End"].includes(e.key) && e.ctrlKey)) {
                  e.preventDefault();
                  setActive((a) => moveActive(a, e.key, flat.length));
                } else if (e.key === "Enter" && flat[active]) {
                  e.preventDefault();
                  go(flat[active].href);
                }
              }}
              placeholder={endpoint ? "Sayfa, hizmet, fatura, talep ara…" : label}
              aria-label={endpoint ? "Ara" : "Sayfa ara"}
              role="combobox"
              aria-expanded="true"
              aria-autocomplete="list"
              aria-controls={listId}
              aria-activedescendant={flat[active] ? `${listId}-${active}` : undefined}
              enterKeyHint="go"
              autoComplete="off"
              spellCheck={false}
              className="h-12 w-full bg-transparent text-base outline-none placeholder:text-muted-foreground sm:text-sm"
            />
            <kbd className="hidden shrink-0 rounded border bg-muted px-1.5 font-mono text-[10px] text-muted-foreground sm:inline">Esc</kbd>
          </div>

          <div ref={listRef} id={listId} role="listbox" aria-label="Sonuçlar" className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-1.5">
            {visible.map((section) => (
              <div key={section.key} role="group" aria-labelledby={`${listId}-${section.key}`} className="pb-1">
                <p
                  id={`${listId}-${section.key}`}
                  className="px-2.5 pb-1 pt-2 font-mono text-[10px] uppercase tracking-wider text-muted-foreground"
                >
                  {section.label}
                </p>
                {section.entries.map((entry) => {
                  index += 1;
                  const i = index;
                  const Icon = icons.get(entry.key);
                  const meta = entry.status ? getStatusMeta(entry.status.kind as StatusKind, entry.status.value, statusAudience) : null;
                  const isActive = i === active;
                  return (
                    <div
                      key={entry.key}
                      id={`${listId}-${i}`}
                      data-index={i}
                      role="option"
                      aria-selected={isActive}
                      onMouseMove={() => !isActive && setActive(i)}
                      onClick={() => go(entry.href)}
                      className={cn(
                        "flex min-h-11 cursor-pointer items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm",
                        isActive ? "bg-muted text-foreground" : "text-muted-foreground"
                      )}
                    >
                      {Icon ? <Icon aria-hidden className="size-4 shrink-0" /> : null}
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-foreground">{entry.title}</span>
                        {entry.subtitle ? <span className="block truncate text-xs text-muted-foreground">{entry.subtitle}</span> : null}
                      </span>
                      {meta ? (
                        <span className="inline-flex shrink-0 items-center gap-1.5 text-xs">
                          <ToneDot tone={meta.tone} />
                          {meta.label}
                        </span>
                      ) : null}
                      {entry.action ? (
                        <a
                          href={entry.action.href}
                          tabIndex={-1}
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            go(entry.action!.href);
                          }}
                          className="shrink-0 rounded border bg-background px-2 py-0.5 text-xs font-medium text-foreground hover:bg-muted"
                        >
                          {entry.action.label}
                        </a>
                      ) : null}
                      {entry.hint && !meta ? (
                        <span className="hidden shrink-0 font-mono text-[10px] uppercase tracking-wider sm:inline">{entry.hint}</span>
                      ) : null}
                      {isActive ? <CornerDownLeft aria-hidden className="hidden size-3.5 shrink-0 sm:block" /> : null}
                    </div>
                  );
                })}
              </div>
            ))}

            {flat.length === 0 && !loading ? (
              <p className="px-3 py-8 text-center text-sm text-muted-foreground">Eşleşen sonuç yok.</p>
            ) : null}
          </div>

          <div
            aria-live="polite"
            className={cn(
              "min-h-9 shrink-0 items-center gap-3 border-t px-3 text-[11px] text-muted-foreground",
              remote.status === "error" || loading || remoteEmpty || (endpoint && !searching) ? "flex" : "hidden sm:flex"
            )}
          >
            {remote.status === "error" ? (
              <span className="text-red-600 dark:text-red-400">{remote.message}</span>
            ) : loading ? (
              <span>Kayıtlar aranıyor…</span>
            ) : remoteEmpty ? (
              <span>Kayıtlarda eşleşme yok.</span>
            ) : endpoint && !searching ? (
              <span>Kayıt aramak için en az {MIN_CHARS} karakter yazın.</span>
            ) : (
              <span className="hidden sm:inline">
                <kbd className="font-mono">↑↓</kbd> gezin · <kbd className="font-mono">Enter</kbd> aç · <kbd className="font-mono">Esc</kbd> kapat
              </span>
            )}
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
