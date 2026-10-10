"use client";

import * as React from "react";
import { Bookmark, BookmarkPlus, Loader2, Settings2, Trash2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FormField, appButton } from "@/components/app";
import {
  deleteSavedFilter,
  listSavedFilters,
  saveFilter,
  type SavedFilterItem,
} from "@/lib/actions/admin/saved-filters";
import {
  describeListView,
  listViewToParams,
  parseListView,
  type AdminListKey,
  type ListView,
} from "@/lib/admin/list-views";
import { toast } from "@/lib/toast";

/**
 * "Görünümler" menu: the staff member's saved search + filter views of this
 * list, "save current view" and a manage dialog (delete).
 */
export function SavedViewsMenu({
  list,
  path,
  view,
  filterIds,
  onApply,
}: {
  list: AdminListKey;
  path: string;
  view: ListView;
  filterIds: string[];
  onApply: (filter: SavedFilterItem) => void;
}) {
  const [items, setItems] = React.useState<SavedFilterItem[] | null>(null);
  const [dialog, setDialog] = React.useState<"save" | "manage" | null>(null);
  const [name, setName] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  const load = React.useCallback(async () => {
    try {
      setItems(await listSavedFilters(list));
    } catch {
      setItems([]);
    }
  }, [list]);

  React.useEffect(() => {
    void load();
  }, [load]);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy || !name.trim()) return;
    setBusy(true);
    const params = listViewToParams(view).toString();
    const result = await saveFilter({ list, path, name, params, filterIds });
    setBusy(false);
    if (!result.success) {
      toast.error(result.error);
      return;
    }
    toast.success(`“${result.filter.name}” görünümü kaydedildi`);
    setDialog(null);
    setName("");
    void load();
  };

  const remove = async (item: SavedFilterItem) => {
    const result = await deleteSavedFilter(item.id);
    if (!result.success) {
      toast.error(result.error);
      return;
    }
    toast.success(`“${item.name}” silindi`);
    void load();
  };

  const summary = (item: SavedFilterItem) => describeListView(parseListView(new URLSearchParams(item.params), filterIds));

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button type="button" className={appButton({ variant: "outline", size: "sm" })}>
            <Bookmark aria-hidden />
            Görünümler
            {items?.length ? <span className="font-mono text-[11px] text-muted-foreground">{items.length}</span> : null}
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64">
          <DropdownMenuLabel className="font-mono text-[11px] font-medium uppercase tracking-[0.1em] text-muted-foreground">
            Kayıtlı görünümler
          </DropdownMenuLabel>
          {items === null ? (
            <DropdownMenuItem disabled>Yükleniyor…</DropdownMenuItem>
          ) : items.length === 0 ? (
            <DropdownMenuItem disabled className="whitespace-normal text-xs">
              Henüz kayıtlı görünüm yok. Arama ve filtreleri ayarlayıp kaydedin.
            </DropdownMenuItem>
          ) : (
            items.map((item) => (
              <DropdownMenuItem key={item.id} onSelect={() => onApply(item)} className="flex cursor-pointer flex-col items-start gap-0.5">
                <span className="w-full truncate">{item.name}</span>
                <span className="w-full truncate text-xs text-muted-foreground">
                  {item.path !== path ? `${item.path.split("/").pop()} · ` : ""}
                  {summary(item)}
                </span>
              </DropdownMenuItem>
            ))
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => setDialog("save")} className="cursor-pointer gap-2 [&_svg]:size-4">
            <BookmarkPlus aria-hidden />
            Bu görünümü kaydet…
          </DropdownMenuItem>
          {items?.length ? (
            <DropdownMenuItem onSelect={() => setDialog("manage")} className="cursor-pointer gap-2 [&_svg]:size-4">
              <Settings2 aria-hidden />
              Görünümleri yönet…
            </DropdownMenuItem>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={dialog !== null} onOpenChange={(o) => (!o ? setDialog(null) : undefined)}>
        <DialogContent className="max-w-md">
          {dialog === "save" ? (
            <form onSubmit={(e) => void save(e)} className="space-y-4">
              <DialogHeader>
                <DialogTitle>Görünümü kaydet</DialogTitle>
                <DialogDescription>
                  Arama ve filtreler ({describeListView(view)}) yalnızca sizin için kaydedilir. Aynı adla kaydederseniz mevcut
                  görünüm güncellenir.
                </DialogDescription>
              </DialogHeader>
              <FormField label="Görünüm adı" htmlFor="saved-view-name" required>
                <input
                  id="saved-view-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  maxLength={60}
                  autoFocus
                  placeholder="Örn. 30+ gün gecikenler"
                  className="h-11 w-full rounded-md border bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:h-9"
                />
              </FormField>
              <DialogFooter className="gap-2 sm:gap-0">
                <button type="button" onClick={() => setDialog(null)} className={appButton({ variant: "outline" })}>
                  Vazgeç
                </button>
                <button type="submit" disabled={busy || !name.trim()} className={appButton()}>
                  {busy ? <Loader2 aria-hidden className="animate-spin" /> : <BookmarkPlus aria-hidden />}
                  Kaydet
                </button>
              </DialogFooter>
            </form>
          ) : null}
          {dialog === "manage" ? (
            <>
              <DialogHeader>
                <DialogTitle>Kayıtlı görünümler</DialogTitle>
                <DialogDescription>Silinen görünüm geri alınamaz; listeler etkilenmez.</DialogDescription>
              </DialogHeader>
              <ul className="max-h-72 divide-y overflow-y-auto rounded-md border">
                {(items ?? []).map((item) => (
                  <li key={item.id} className="flex items-center gap-2 px-3 py-2">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{item.name}</p>
                      <p className="truncate text-xs text-muted-foreground">{summary(item)}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => void remove(item)}
                      aria-label={`“${item.name}” görünümünü sil`}
                      className={appButton({ variant: "ghost", size: "icon-sm" })}
                    >
                      <Trash2 aria-hidden />
                    </button>
                  </li>
                ))}
              </ul>
              <DialogFooter>
                <button type="button" onClick={() => setDialog(null)} className={appButton({ variant: "outline" })}>
                  Kapat
                </button>
              </DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}
