/**
 * Small in-memory stand-in for the Prisma client, enough for the saved-card
 * and auto-charge unit tests: where filters (equality, in/not/gte/gt/lt/lte,
 * NOT/OR, configured relation filters), orderBy, include of configured
 * relations, unique constraints (P2002) and $transaction. Not a general fake.
 */
import { Prisma } from "@prisma/client";

type Row = Record<string, unknown> & { id: string };
type Where = Record<string, unknown>;

interface RelationConfig {
  /** Related table and the foreign key on this row (to-one) or on the other row (to-many). */
  table: string;
  kind: "one" | "many";
  /** to-one: column on this row holding the related id. to-many: column on the related row pointing here. */
  key: string;
}

export interface FakeTableConfig {
  unique?: string[];
  defaults?: () => Record<string, unknown>;
  relations?: Record<string, RelationConfig>;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !(value instanceof Date) &&
    !Array.isArray(value) &&
    !(value instanceof Prisma.Decimal)
  );
}

function comparable(value: unknown) {
  if (value instanceof Date) return value.getTime();
  if (value instanceof Prisma.Decimal) return value.toNumber();
  return value as number | string;
}

const OPERATORS = new Set(["in", "notIn", "not", "gte", "gt", "lt", "lte", "equals"]);

export function createFakePrisma(config: Record<string, FakeTableConfig>) {
  const tables = new Map<string, Row[]>(Object.keys(config).map((name) => [name, []]));
  let seq = 0;

  const rows = (table: string) => {
    const list = tables.get(table);
    if (!list) throw new Error(`fake-prisma: unknown table ${table}`);
    return list;
  };

  function matchField(value: unknown, condition: unknown): boolean {
    if (!isPlainObject(condition) || !Object.keys(condition).every((key) => OPERATORS.has(key))) {
      return comparable(value) === comparable(condition) || (value == null && condition == null);
    }
    for (const [op, operand] of Object.entries(condition)) {
      const left = comparable(value);
      switch (op) {
        case "equals":
          if (left !== comparable(operand)) return false;
          break;
        case "in":
          if (!(operand as unknown[]).map(comparable).includes(left)) return false;
          break;
        case "notIn":
          if ((operand as unknown[]).map(comparable).includes(left)) return false;
          break;
        case "not":
          if (isPlainObject(operand) ? matchField(value, operand) : left === comparable(operand)) return false;
          break;
        case "gte":
          if (value == null || left < comparable(operand)) return false;
          break;
        case "gt":
          if (value == null || left <= comparable(operand)) return false;
          break;
        case "lt":
          if (value == null || left >= comparable(operand)) return false;
          break;
        case "lte":
          if (value == null || left > comparable(operand)) return false;
          break;
      }
    }
    return true;
  }

  function matches(table: string, row: Row, where: Where | undefined): boolean {
    if (!where) return true;
    for (const [key, condition] of Object.entries(where)) {
      if (condition === undefined) continue;
      if (key === "NOT") {
        const list = Array.isArray(condition) ? condition : [condition];
        if (list.some((sub) => matches(table, row, sub as Where))) return false;
        continue;
      }
      if (key === "OR") {
        if (!(condition as Where[]).some((sub) => matches(table, row, sub))) return false;
        continue;
      }
      const relation = config[table].relations?.[key];
      if (relation) {
        if (relation.kind === "one") {
          const target = rows(relation.table).find((candidate) => candidate.id === row[relation.key]);
          if (!target || !matches(relation.table, target, condition as Where)) return false;
        } else {
          const related = rows(relation.table).filter((candidate) => candidate[relation.key] === row.id);
          const filter = condition as { none?: Where; some?: Where; every?: Where };
          if (filter.none && related.some((candidate) => matches(relation.table, candidate, filter.none))) return false;
          if (filter.some && !related.some((candidate) => matches(relation.table, candidate, filter.some))) return false;
        }
        continue;
      }
      if (!matchField(row[key], condition)) return false;
    }
    return true;
  }

  function sort(list: Row[], orderBy: unknown) {
    const orders = (Array.isArray(orderBy) ? orderBy : orderBy ? [orderBy] : []) as Record<string, "asc" | "desc">[];
    return [...list].sort((a, b) => {
      for (const order of orders) {
        const [field, direction] = Object.entries(order)[0];
        const left = comparable(a[field]);
        const right = comparable(b[field]);
        if (left === right) continue;
        const result = left > right ? 1 : -1;
        return direction === "desc" ? -result : result;
      }
      return 0;
    });
  }

  function withIncludes(table: string, row: Row, include: Record<string, unknown> | undefined): Row {
    const copy = { ...row };
    if (!include) return copy;
    for (const key of Object.keys(include)) {
      const relation = config[table].relations?.[key];
      if (!relation) continue;
      copy[key] =
        relation.kind === "one"
          ? (rows(relation.table).find((candidate) => candidate.id === row[relation.key]) ?? null)
          : rows(relation.table).filter((candidate) => candidate[relation.key] === row.id);
    }
    return copy;
  }

  function assertUnique(table: string, candidate: Row, ignoreId?: string) {
    for (const field of config[table].unique ?? []) {
      const value = candidate[field];
      if (value == null) continue;
      if (rows(table).some((row) => row.id !== ignoreId && row[field] === value)) {
        throw new Prisma.PrismaClientKnownRequestError(`Unique constraint failed on ${field}`, {
          code: "P2002",
          clientVersion: "fake",
          meta: { target: [field] },
        });
      }
    }
  }

  function findOne(table: string, where: Where) {
    return rows(table).find((row) => matches(table, row, where)) ?? null;
  }

  function applyData(row: Row, data: Record<string, unknown>) {
    for (const [key, value] of Object.entries(data)) {
      if (value === undefined) continue;
      if (isPlainObject(value) && "increment" in value) {
        row[key] = Number(row[key] ?? 0) + Number(value.increment);
      } else {
        row[key] = value;
      }
    }
    if ("updatedAt" in row) row.updatedAt = new Date();
  }

  function delegate(table: string) {
    return {
      findUnique: async ({ where, include }: { where: Where; include?: Record<string, unknown> }) => {
        const row = findOne(table, where);
        return row ? withIncludes(table, row, include) : null;
      },
      findUniqueOrThrow: async ({ where, include }: { where: Where; include?: Record<string, unknown> }) => {
        const row = findOne(table, where);
        if (!row) throw new Error(`fake-prisma: ${table} not found`);
        return withIncludes(table, row, include);
      },
      findFirst: async ({ where, orderBy, include }: { where?: Where; orderBy?: unknown; include?: Record<string, unknown> } = {}) => {
        const row = sort(rows(table).filter((candidate) => matches(table, candidate, where)), orderBy)[0];
        return row ? withIncludes(table, row, include) : null;
      },
      findMany: async ({ where, orderBy, take, include }: { where?: Where; orderBy?: unknown; take?: number; include?: Record<string, unknown> } = {}) => {
        const list = sort(rows(table).filter((row) => matches(table, row, where)), orderBy);
        return (take ? list.slice(0, take) : list).map((row) => withIncludes(table, row, include));
      },
      count: async ({ where }: { where?: Where } = {}) => rows(table).filter((row) => matches(table, row, where)).length,
      create: async ({ data }: { data: Record<string, unknown> }) => {
        seq += 1;
        const row = {
          id: `${table}_${seq}`,
          createdAt: new Date(),
          ...(config[table].defaults?.() ?? {}),
          ...data,
        } as Row;
        assertUnique(table, row);
        rows(table).push(row);
        return { ...row };
      },
      update: async ({ where, data }: { where: Where; data: Record<string, unknown> }) => {
        const row = findOne(table, where);
        if (!row) throw new Error(`fake-prisma: ${table} to update not found`);
        const next = { ...row };
        applyData(next, data);
        assertUnique(table, next, row.id);
        Object.assign(row, next);
        return { ...row };
      },
      updateMany: async ({ where, data }: { where?: Where; data: Record<string, unknown> }) => {
        const targets = rows(table).filter((row) => matches(table, row, where));
        for (const row of targets) applyData(row, data);
        return { count: targets.length };
      },
    };
  }

  const client: Record<string, unknown> = {
    $queryRaw: async () => [],
    $transaction: async (input: unknown) => {
      if (Array.isArray(input)) return Promise.all(input);
      return (input as (tx: unknown) => Promise<unknown>)(client);
    },
  };
  for (const table of Object.keys(config)) client[table] = delegate(table);

  return {
    db: client,
    rows,
    insert(table: string, data: Record<string, unknown>) {
      seq += 1;
      const row = { id: `${table}_${seq}`, createdAt: new Date(), ...(config[table].defaults?.() ?? {}), ...data } as Row;
      rows(table).push(row);
      return row;
    },
  };
}

/** Tables used by saved cards / auto-charge. */
export function createSavedCardsFakeDb() {
  return createFakePrisma({
    user: { relations: {} },
    setting: {},
    invoice: {
      relations: {
        customer: { table: "user", kind: "one", key: "customerId" },
        bankTransferNotices: { table: "bankTransferNotice", kind: "many", key: "invoiceId" },
      },
    },
    bankTransferNotice: {},
    payment: { unique: [] },
    savedCard: {
      unique: ["verificationRef"],
      defaults: () => ({
        gatewayCustomerRef: "",
        cardToken: "",
        last4: "",
        brand: "",
        cardProgram: null,
        expMonth: null,
        expYear: null,
        bankName: null,
        requireCvv: false,
        isDefault: false,
        status: "PENDING",
        verificationRefundedAt: null,
        failureReason: null,
        expiryNoticeSentAt: null,
        deletedAt: null,
        updatedAt: new Date(),
      }),
      relations: { user: { table: "user", kind: "one", key: "userId" } },
    },
    paymentAttempt: {
      unique: ["idempotencyKey", "gatewayRef"],
      defaults: () => ({ status: "PENDING", errorCode: null, errorMessage: null, finishedAt: null }),
    },
  });
}
