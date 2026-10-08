/**
 * Stateful fake of the Cloudflare v4 endpoints the DNS module uses (tests
 * only). Behaves like the real API where it matters: zone lookup by name +
 * account, small page size (forces pagination), TXT content returned quoted,
 * SRV/CAA in `data`, 81044 for missing records, 1061 for zones that exist
 * elsewhere, and optional 429 answers with Retry-After.
 */
import { vi } from "vitest";

interface FakeZone {
  id: string;
  name: string;
  status: string;
  name_servers: string[];
  account: { id: string };
}

interface FakeRecord {
  id: string;
  zone_id: string;
  type: string;
  name: string;
  content: string;
  ttl: number;
  proxied: boolean;
  proxiable: boolean;
  priority?: number;
  data?: Record<string, unknown>;
  comment?: string | null;
}

export interface FakeCloudflareOptions {
  accountId: string;
  /** Max per_page the fake honours (real: 5000 records / 50 zones). */
  pageSize?: number;
  /** Zones that "exist in another account" (POST → 1061). */
  foreignZones?: string[];
  /** Answer the next N requests matching the predicate with 429. */
  rateLimit?: { count: number; retryAfter?: string; match?: (method: string, path: string) => boolean };
}

const BASE = "https://api.cloudflare.com/client/v4";

function envelope(result: unknown, resultInfo?: Record<string, number>) {
  return { success: true, errors: [], messages: [], result, ...(resultInfo ? { result_info: resultInfo } : {}) };
}

function errorResponse(status: number, code: number, message: string) {
  return new Response(JSON.stringify({ success: false, errors: [{ code, message }], messages: [], result: null }), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

let counter = 0;
const hexId = () => (++counter).toString(16).padStart(32, "0");

export function createFakeCloudflare(options: FakeCloudflareOptions) {
  const zones: FakeZone[] = [];
  const records: FakeRecord[] = [];
  const requests: Array<{ method: string; path: string; query: URLSearchParams; body: unknown }> = [];
  const pageSize = options.pageSize ?? 2;
  let rateLimited = options.rateLimit?.count ?? 0;

  function page<T>(items: T[], query: URLSearchParams) {
    const perPage = Math.min(Number(query.get("per_page") ?? 20), pageSize);
    const current = Math.max(1, Number(query.get("page") ?? 1));
    const slice = items.slice((current - 1) * perPage, current * perPage);
    return json(
      envelope(slice, {
        page: current,
        per_page: perPage,
        count: slice.length,
        total_count: items.length,
        total_pages: Math.max(1, Math.ceil(items.length / perPage)),
      })
    );
  }

  function storeRecord(zoneId: string, body: Record<string, unknown>, id = hexId()): FakeRecord {
    const type = String(body.type);
    const data = body.data as Record<string, unknown> | undefined;
    let content = String(body.content ?? "");
    if (type === "TXT" && !content.startsWith('"')) content = `"${content.replace(/"/g, '\\"')}"`;
    if (type === "SRV" && data) content = `${data.weight} ${data.port} ${data.target}`;
    if (type === "CAA" && data) content = `${data.flags} ${data.tag} "${data.value}"`;
    return {
      id,
      zone_id: zoneId,
      type,
      name: String(body.name),
      content,
      ttl: Number(body.ttl ?? 1),
      proxied: Boolean(body.proxied),
      proxiable: ["A", "AAAA", "CNAME"].includes(type),
      ...(type === "MX" ? { priority: Number(body.priority ?? 10) } : {}),
      ...(type === "SRV" && data ? { priority: Number(data.priority), data } : {}),
      ...(type === "CAA" && data ? { data } : {}),
      comment: (body.comment as string | undefined) ?? null,
    };
  }

  const handler = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url);
    if (!url.toString().startsWith(BASE)) throw new Error(`Unexpected request in test: ${url}`);
    const method = (init?.method ?? "GET").toUpperCase();
    const path = url.pathname.replace("/client/v4", "");
    const body = typeof init?.body === "string" ? JSON.parse(init.body) : undefined;
    requests.push({ method, path, query: url.searchParams, body });

    const auth = new Headers(init?.headers).get("authorization");
    if (!auth?.startsWith("Bearer ")) return errorResponse(400, 6003, "Invalid request headers");

    if (rateLimited > 0 && (!options.rateLimit?.match || options.rateLimit.match(method, path))) {
      rateLimited--;
      return new Response(JSON.stringify({ success: false, errors: [{ code: 971, message: "Please wait" }] }), {
        status: 429,
        headers: { "content-type": "application/json", ...(options.rateLimit?.retryAfter ? { "retry-after": options.rateLimit.retryAfter } : {}) },
      });
    }

    if (path === "/user/tokens/verify" && method === "GET") {
      return json(envelope({ id: "token", status: "active" }));
    }

    if (path === "/zones" && method === "GET") {
      const name = url.searchParams.get("name");
      const account = url.searchParams.get("account.id");
      return page(
        zones.filter((zone) => (!name || zone.name === name) && (!account || zone.account.id === account)),
        url.searchParams
      );
    }

    if (path === "/zones" && method === "POST") {
      if (options.foreignZones?.includes(body.name)) {
        return errorResponse(400, 1061, `${body.name} already exists`);
      }
      if (zones.some((zone) => zone.name === body.name)) return errorResponse(400, 1061, "already exists");
      const zone: FakeZone = {
        id: hexId(),
        name: body.name,
        status: "pending",
        name_servers: ["isaac.ns.cloudflare.com", "luciane.ns.cloudflare.com"],
        account: { id: body.account.id },
      };
      zones.push(zone);
      return json(envelope(zone));
    }

    const zoneMatch = path.match(/^\/zones\/([^/]+)(\/dns_records(?:\/([^/]+))?)?$/);
    if (!zoneMatch) return errorResponse(400, 7003, "Could not route");
    const zone = zones.find((candidate) => candidate.id === zoneMatch[1]);
    if (!zone) return errorResponse(400, 7003, "Could not route, perhaps your object identifier is invalid?");

    if (!zoneMatch[2]) {
      if (method === "DELETE") {
        zones.splice(zones.indexOf(zone), 1);
        for (let i = records.length - 1; i >= 0; i--) if (records[i].zone_id === zone.id) records.splice(i, 1);
        return json(envelope({ id: zone.id }));
      }
      return json(envelope(zone));
    }

    const recordId = zoneMatch[3];
    if (!recordId) {
      if (method === "GET") {
        const type = url.searchParams.get("type");
        const name = url.searchParams.get("name");
        return page(
          records.filter((r) => r.zone_id === zone.id && (!type || r.type === type) && (!name || r.name === name)),
          url.searchParams
        );
      }
      if (method === "POST") {
        const duplicate = records.find(
          (r) => r.zone_id === zone.id && r.type === body.type && r.name === body.name && storeRecord(zone.id, body, r.id).content === r.content
        );
        if (duplicate) return errorResponse(400, 81058, "An identical record already exists.");
        const cnameClash = records.find(
          (r) => r.zone_id === zone.id && r.name === body.name && (r.type === "CNAME") !== (body.type === "CNAME") && ["A", "AAAA", "CNAME"].includes(body.type)
        );
        if (cnameClash) return errorResponse(400, 81053, "An A, AAAA, or CNAME record with that host already exists.");
        const record = storeRecord(zone.id, body);
        records.push(record);
        return json(envelope(record));
      }
    }

    const index = records.findIndex((r) => r.zone_id === zone.id && r.id === recordId);
    if (index < 0) return errorResponse(404, 81044, "Record does not exist.");
    if (method === "DELETE") {
      records.splice(index, 1);
      return json(envelope({ id: recordId }));
    }
    if (method === "PUT" || method === "PATCH") {
      records[index] = storeRecord(zone.id, method === "PATCH" ? { ...records[index], ...body } : body, recordId);
      return json(envelope(records[index]));
    }
    return json(envelope(records[index]));
  });

  vi.stubGlobal("fetch", handler);

  return {
    fetch: handler,
    zones,
    records,
    requests,
    /** Seed a zone (e.g. an existing active zone). */
    addZone(name: string, status = "active", accountId = options.accountId) {
      const zone: FakeZone = {
        id: hexId(),
        name,
        status,
        name_servers: ["isaac.ns.cloudflare.com", "luciane.ns.cloudflare.com"],
        account: { id: accountId },
      };
      zones.push(zone);
      return zone;
    },
    addRecord(zoneId: string, body: Record<string, unknown>) {
      const record = storeRecord(zoneId, body);
      records.push(record);
      return record;
    },
    writes() {
      return requests.filter((request) => request.method !== "GET");
    },
  };
}
