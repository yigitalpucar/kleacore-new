"use server";

/**
 * Saved admin list views per staff member (UI3 item 11). A view is a list
 * route + the query string the table reads (src/lib/admin/list-views.ts).
 * Each call needs the view permission of the list it touches.
 */
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { hasPermission } from "@/lib/auth/permissions";
import {
  LIST_VIEW_PERMISSION,
  isAdminListKey,
  isValidListPath,
  listViewToParams,
  parseListView,
  type AdminListKey,
} from "@/lib/admin/list-views";
import { requireAnyPermission } from "@/lib/utils/auth-helpers";

const MAX_PER_LIST = 30;
const NAME_MAX = 60;

export interface SavedFilterItem {
  id: string;
  name: string;
  path: string;
  params: string;
}

type Fail = { success: false; error: string };

/** Any list's view permission lets a staff member use saved views; each list then needs its own. */
const ANY_LIST_VIEW = ["invoices.view", "services.view", "customers.view", "orders.view", "tickets.view"] as const;

type StaffSession = Awaited<ReturnType<typeof requireAnyPermission>>;

function staffFor(session: StaffSession, list: unknown): { userId: string; list: AdminListKey } | null {
  if (!isAdminListKey(list) || !hasPermission(session.user.role, LIST_VIEW_PERMISSION[list])) return null;
  return { userId: session.user.id, list };
}

export async function listSavedFilters(list: string): Promise<SavedFilterItem[]> {
  const session = await requireAnyPermission(...ANY_LIST_VIEW);
  const staff = staffFor(session, list);
  if (!staff) return [];
  return db.savedFilter.findMany({
    where: { userId: staff.userId, list: staff.list },
    orderBy: { name: "asc" },
    select: { id: true, name: true, path: true, params: true },
  });
}

export async function saveFilter(input: {
  list: string;
  path: string;
  name: string;
  params: string;
  filterIds: string[];
}): Promise<{ success: true; filter: SavedFilterItem } | Fail> {
  const session = await requireAnyPermission(...ANY_LIST_VIEW);
  const staff = staffFor(session, input.list);
  if (!staff) return { success: false, error: "Bu liste için yetkiniz yok" };

  const name = typeof input.name === "string" ? input.name.trim().replace(/\s+/g, " ") : "";
  if (!name) return { success: false, error: "Görünüm adı girin" };
  if (name.length > NAME_MAX) return { success: false, error: `Görünüm adı en fazla ${NAME_MAX} karakter olabilir` };
  if (typeof input.path !== "string" || !isValidListPath(staff.list, input.path)) {
    return { success: false, error: "Geçersiz liste adresi" };
  }

  // Re-serialise so only q / f_<id> with safe values are stored.
  const filterIds = Array.isArray(input.filterIds) ? input.filterIds.filter((id) => typeof id === "string").slice(0, 10) : [];
  const params = listViewToParams(parseListView(new URLSearchParams(String(input.params ?? "")), filterIds)).toString();

  const count = await db.savedFilter.count({ where: { userId: staff.userId, list: staff.list } });
  try {
    const existing = await db.savedFilter.findUnique({
      where: { userId_list_name: { userId: staff.userId, list: staff.list, name } },
      select: { id: true },
    });
    if (!existing && count >= MAX_PER_LIST) {
      return { success: false, error: `Bir liste için en fazla ${MAX_PER_LIST} görünüm kaydedilebilir` };
    }
    // Same name → overwrite (update the view in place).
    const filter = await db.savedFilter.upsert({
      where: { userId_list_name: { userId: staff.userId, list: staff.list, name } },
      create: { userId: staff.userId, list: staff.list, name, path: input.path, params },
      update: { path: input.path, params },
      select: { id: true, name: true, path: true, params: true },
    });
    return { success: true, filter };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { success: false, error: "Bu adla bir görünüm zaten var" };
    }
    throw error;
  }
}

export async function deleteSavedFilter(id: string): Promise<{ success: true } | Fail> {
  const session = await requireAnyPermission(...ANY_LIST_VIEW);
  // Only the owner's own rows.
  const result = await db.savedFilter.deleteMany({ where: { id: String(id), userId: session.user.id } });
  if (result.count === 0) return { success: false, error: "Görünüm bulunamadı" };
  return { success: true };
}
