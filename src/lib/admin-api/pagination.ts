/**
 * Cursor (keyset) pagination: `?limit=25&cursor=<opaque>`. The cursor encodes
 * the last row's sort value + id, so pages stay stable while rows are added
 * or deleted. Response: `pagination: { nextCursor, hasMore, limit }`.
 */
import { z } from "zod/v4";
import { ApiError } from "./errors";

export const DEFAULT_LIMIT = 25;
export const MAX_LIMIT = 100;

export const paginationQuery = {
  limit: z.coerce.number().int().min(1).max(MAX_LIMIT).default(DEFAULT_LIMIT).describe(`Sayfa boyutu (1–${MAX_LIMIT})`),
  cursor: z.string().max(200).optional().describe("Önceki yanıttaki pagination.nextCursor"),
};

export const paginationSchema = z.object({
  nextCursor: z.string().nullable().describe("Sonraki sayfa için cursor; null = son sayfa"),
  hasMore: z.boolean(),
  limit: z.number().int(),
});

export type Pagination = z.infer<typeof paginationSchema>;

interface Cursor {
  /** Sort value (ISO date). */
  v: string;
  id: string;
}

export function encodeCursor(value: Date, id: string): string {
  return Buffer.from(JSON.stringify({ v: value.toISOString(), id } satisfies Cursor)).toString("base64url");
}

export function decodeCursor(cursor: string | undefined): { value: Date; id: string } | null {
  if (!cursor) return null;
  try {
    const parsed = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8")) as Partial<Cursor>;
    const value = new Date(String(parsed.v));
    if (typeof parsed.id !== "string" || !parsed.id || Number.isNaN(value.getTime())) throw new Error("bad cursor");
    return { value, id: parsed.id };
  } catch {
    throw new ApiError(400, "invalid_cursor", "Geçersiz sayfalama imleci");
  }
}

/**
 * Prisma `where` + `orderBy` for one page sorted by `field` (a DateTime
 * column) then id, in `direction`; fetch `take` rows and pass them to
 * `pageOf`.
 */
export function keyset<F extends string>(
  field: F,
  query: { limit: number; cursor?: string },
  direction: "asc" | "desc" = "desc"
) {
  const cursor = decodeCursor(query.cursor);
  const op = direction === "desc" ? "lt" : "gt";
  const where = cursor
    ? { OR: [{ [field]: { [op]: cursor.value } }, { [field]: cursor.value, id: { [op]: cursor.id } }] }
    : {};
  return {
    where,
    orderBy: [{ [field]: direction }, { id: direction }] as Array<Record<string, "asc" | "desc">>,
    take: query.limit + 1,
  };
}

export function pageOf<T extends { id: string }>(rows: T[], limit: number, sortValue: (row: T) => Date) {
  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;
  const last = items[items.length - 1];
  return {
    items,
    pagination: {
      nextCursor: hasMore && last ? encodeCursor(sortValue(last), last.id) : null,
      hasMore,
      limit,
    } satisfies Pagination,
  };
}
