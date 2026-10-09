/**
 * Permission coverage of the admin API: every route file serves registry
 * operations, every operation maps to a real permission (null only for the
 * introspection endpoints), and every operation is reachable at the route
 * file its path names.
 */
import { readdirSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({ db: {} }));
vi.mock("@/lib/utils/auth-helpers", () => ({ staffTwoFactorMissing: vi.fn() }));

import { PERMISSIONS } from "@/lib/auth/permissions";
import { ADMIN_API_OPERATIONS } from "./registry";
import type { AdminApiRouteHandler } from "./route";

const ROOT = path.resolve(__dirname, "../../..");

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = path.join(dir, entry);
    return statSync(full).isDirectory() ? walk(full) : entry === "route.ts" ? [full] : [];
  });
}

/** "/src/app/api/admin/v1/customers/[id]/route.ts" → loader */
const routeModules = Object.fromEntries(
  walk(path.join(ROOT, "src/app/api/admin/v1")).map((file) => [
    `/${path.relative(ROOT, file).split(path.sep).join("/")}`,
    () => import(file) as Promise<Record<string, unknown>>,
  ])
);
const METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"] as const;
/** Endpoints any valid token may call. */
const PUBLIC_TO_ANY_TOKEN = new Set(["/me", "/openapi.json"]);

/** "/src/app/api/admin/v1/customers/[id]/route.ts" → "/customers/{id}" */
function apiPathOf(file: string) {
  return file
    .replace("/src/app/api/admin/v1", "")
    .replace(/\/route\.ts$/, "")
    .replace(/\[([^\]]+)\]/g, "{$1}");
}

describe("admin API permission coverage", () => {
  it("every operation requires a known permission (null only for introspection)", () => {
    const problems: string[] = [];
    for (const operation of ADMIN_API_OPERATIONS) {
      if (operation.permission === null) {
        if (!PUBLIC_TO_ANY_TOKEN.has(operation.path)) problems.push(`${operation.id}: no permission`);
      } else if (!(PERMISSIONS as readonly string[]).includes(operation.permission)) {
        problems.push(`${operation.id}: unknown permission ${operation.permission}`);
      }
    }
    expect(problems).toEqual([]);
  });

  it("operation ids and method+path pairs are unique", () => {
    const ids = ADMIN_API_OPERATIONS.map((operation) => operation.id);
    const routes = ADMIN_API_OPERATIONS.map((operation) => `${operation.method} ${operation.path}`);
    expect(new Set(ids).size).toBe(ids.length);
    expect(new Set(routes).size).toBe(routes.length);
  });

  it("every route handler serves a registry operation at its own path", async () => {
    const problems: string[] = [];
    const served = new Set<string>();
    expect(Object.keys(routeModules).length).toBeGreaterThan(20);
    for (const [file, load] of Object.entries(routeModules)) {
      const mod = await load();
      const apiPath = apiPathOf(file);
      for (const method of METHODS) {
        const handler = mod[method] as AdminApiRouteHandler | undefined;
        if (!handler) continue;
        const operation = handler.operation;
        if (!operation || !ADMIN_API_OPERATIONS.includes(operation)) {
          problems.push(`${file} ${method}: not a registry operation`);
          continue;
        }
        if (operation.method !== method) problems.push(`${file} ${method}: operation ${operation.id} is ${operation.method}`);
        if (operation.path !== apiPath) problems.push(`${file} ${method}: operation ${operation.id} declares ${operation.path}`);
        served.add(operation.id);
      }
    }
    const unserved = ADMIN_API_OPERATIONS.filter((operation) => !served.has(operation.id)).map((operation) => operation.id);
    expect(problems).toEqual([]);
    expect(unserved, "registry operations without a route file").toEqual([]);
  });

  it("write operations need a write permission, reads a view-level one", () => {
    // Guards against mapping a mutation to a read-only scope by mistake.
    const readOnly = new Set(["customers.view", "tickets.view", "invoices.view", "orders.view", "services.view", "domains.view", "reports.view", "activity.view"]);
    const problems = ADMIN_API_OPERATIONS.filter(
      (operation) => operation.method !== "GET" && operation.permission !== null && readOnly.has(operation.permission)
    ).map((operation) => `${operation.id} (${operation.method}) → ${operation.permission}`);
    expect(problems).toEqual([]);
  });
});
