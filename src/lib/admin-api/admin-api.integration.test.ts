/**
 * Admin API end-to-end against a real Postgres, through the real route
 * handlers: cursor pagination, Idempotency-Key replay, owner demotion,
 * expiry / IP allowlist, audit rows, a ticket reply as the token owner and
 * mark-paid through the fulfilment path with a manual payment record.
 *
 *   RUN_DB_TESTS=1 pnpm vitest run src/lib/admin-api/admin-api.integration.test.ts
 */
import "dotenv/config";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
// auth-helpers (staffTwoFactorMissing) pulls in next-auth; sessions are not used here.
vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/notifications/send", () => ({ sendNotification: vi.fn(async () => ({ ok: true, logIds: [], deduplicated: false })) }));

import { randomUUID } from "node:crypto";
import { db } from "@/lib/db";
import { getBoss, stopBoss } from "@/lib/jobs/boss";
import { EVENTS_DISPATCH_JOB } from "@/lib/jobs/definitions";
import { netInvoiceLine } from "@/lib/billing/invoice-lines";
import { GET as listCustomers, POST as createCustomer } from "@/app/api/admin/v1/customers/route";
import { GET as getMe } from "@/app/api/admin/v1/me/route";
import { POST as replyToTicket } from "@/app/api/admin/v1/tickets/[id]/reply/route";
import { POST as markPaid } from "@/app/api/admin/v1/invoices/[id]/mark-paid/route";
import { GET as openapi } from "@/app/api/admin/v1/openapi.json/route";
import { createStaffApiToken } from "./tokens";

const enabled = process.env.RUN_DB_TESTS === "1";
const tag = `itest-api-${randomUUID().slice(0, 8)}`;
const ip = "198.51.100.23";
let staffId = "";
let secret = "";
let tokenId = "";
const customerIds: string[] = [];
let invoiceId = "";
let ticketId = "";

type Handler = (request: Request, context: { params: Promise<Record<string, string>> }) => Promise<Response>;

function call(handler: Handler, path: string, init: { method?: string; body?: unknown; headers?: Record<string, string>; params?: Record<string, string>; token?: string } = {}) {
  const request = new Request(`http://localhost:3020/api/admin/v1${path}`, {
    method: init.method ?? "GET",
    headers: {
      authorization: `Bearer ${init.token ?? secret}`,
      "x-forwarded-for": ip,
      ...(init.body !== undefined ? { "content-type": "application/json" } : {}),
      ...init.headers,
    },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
  return handler(request, { params: Promise.resolve(init.params ?? {}) });
}

describe.skipIf(!enabled)("admin API (db)", () => {
  beforeAll(async () => {
    const staff = await db.user.create({
      data: { email: `${tag}-staff@test.local`, password: "x", name: "Ajan", surname: "Sahibi", role: "ADMIN", status: "ACTIVE" },
    });
    staffId = staff.id;
    for (let i = 0; i < 3; i += 1) {
      const customer = await db.user.create({
        data: { email: `${tag}-c${i}@test.local`, password: "x", name: `${tag}`, surname: `C${i}`, role: "CUSTOMER", createdAt: new Date(Date.UTC(2026, 0, 1 + i)) },
      });
      customerIds.push(customer.id);
    }
    const created = await createStaffApiToken(
      { id: staffId, role: "ADMIN" },
      { name: "itest", scopes: ["customers.view", "customers.edit", "tickets.view", "tickets.reply", "invoices.edit"], ipAllowlist: "198.51.100.0/24" }
    );
    secret = created.secret;
    tokenId = created.token.id;

    const line = netInvoiceLine({ description: "API testi", unitPrice: 100 });
    const invoice = await db.invoice.create({
      data: {
        invoiceNumber: `${tag}-INV`,
        customerId: customerIds[0],
        subtotal: 100,
        taxRate: 20,
        taxAmount: 20,
        totalAmount: 120,
        status: "PENDING",
        dueDate: new Date(Date.now() + 7 * 86_400_000),
        items: { create: line },
      },
    });
    invoiceId = invoice.id;
    const ticket = await db.supportTicket.create({
      data: { ticketNumber: `${tag}-T`, customerId: customerIds[0], subject: "API ile yanıt", status: "CUSTOMER_REPLY" },
    });
    ticketId = ticket.id;
  });

  afterAll(async () => {
    if (!staffId) return;
    const events = await db.domainEvent.findMany({ where: { aggregateId: { in: [invoiceId, ticketId, ...customerIds] } } });
    const boss = await getBoss();
    for (const event of events) {
      const queued = await boss.findJobs(EVENTS_DISPATCH_JOB, { key: event.id });
      if (queued.length) await boss.deleteJob(EVENTS_DISPATCH_JOB, queued.map((q) => q.id));
    }
    await db.domainEvent.deleteMany({ where: { id: { in: events.map((event) => event.id) } } });
    const createdUsers = await db.user.findMany({ where: { email: { startsWith: tag } }, select: { id: true } });
    const userIds = createdUsers.map((user) => user.id);
    await db.ticketMessage.deleteMany({ where: { ticketId } });
    await db.supportTicket.deleteMany({ where: { id: ticketId } });
    await db.payment.deleteMany({ where: { invoiceId } });
    await db.eInvoiceRecord.deleteMany({ where: { invoiceId } });
    await db.invoiceItem.deleteMany({ where: { invoiceId } });
    await db.invoice.deleteMany({ where: { id: invoiceId } });
    await db.activityLog.deleteMany({ where: { userId: { in: userIds } } });
    await db.user.deleteMany({ where: { id: { in: userIds } } });
    await stopBoss();
  });

  it("introspects the token", async () => {
    const response = await call(getMe, "/me");
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data.owner.id).toBe(staffId);
    expect(body.data.scopes).toContain("customers.edit");
  });

  it("pages customers with a cursor, newest first, without overlap", async () => {
    const first = await call(listCustomers, `/customers?q=${tag}&limit=2`);
    const page1 = await first.json();
    expect(page1.data.map((c: { id: string }) => c.id)).toEqual([customerIds[2], customerIds[1]]);
    expect(page1.pagination).toMatchObject({ hasMore: true, limit: 2 });

    const second = await call(listCustomers, `/customers?q=${tag}&limit=2&cursor=${page1.pagination.nextCursor}`);
    const page2 = await second.json();
    expect(page2.data.map((c: { id: string }) => c.id)).toEqual([customerIds[0]]);
    expect(page2.pagination).toEqual({ nextCursor: null, hasMore: false, limit: 2 });

    const bad = await call(listCustomers, "/customers?cursor=garbage");
    expect(bad.status).toBe(400);
  });

  it("creates a customer once per Idempotency-Key", async () => {
    const body = { email: `${tag}-new@test.local`, name: "Yeni", surname: "Müşteri" };
    const first = await call(createCustomer, "/customers", { method: "POST", body, headers: { "idempotency-key": `${tag}-k1` } });
    expect(first.status).toBe(201);
    const created = await first.json();

    const retry = await call(createCustomer, "/customers", { method: "POST", body, headers: { "idempotency-key": `${tag}-k1` } });
    expect(retry.status).toBe(201);
    expect(retry.headers.get("idempotent-replayed")).toBe("true");
    expect((await retry.json()).data.id).toBe(created.data.id);
    expect(await db.user.count({ where: { email: `${tag}-new@test.local` } })).toBe(1);

    const other = await call(createCustomer, "/customers", {
      method: "POST",
      body: { ...body, name: "Başka" },
      headers: { "idempotency-key": `${tag}-k1` },
    });
    expect(other.status).toBe(422);
    expect((await other.json()).error.code).toBe("idempotency_key_reused");
  });

  it("replies to a ticket as the token owner", async () => {
    const response = await call(replyToTicket, `/tickets/${ticketId}/reply`, {
      method: "POST",
      body: { message: "Merhaba, inceledik.", status: "WAITING" },
      params: { id: ticketId },
    });
    expect(response.status).toBe(201);
    const message = await db.ticketMessage.findFirstOrThrow({ where: { ticketId } });
    expect(message).toMatchObject({ senderId: staffId, senderName: "Ajan Sahibi", source: "API" });
    expect((await db.supportTicket.findUniqueOrThrow({ where: { id: ticketId } })).status).toBe("WAITING");
  });

  it("marks an invoice paid with a manual payment record through fulfilment", async () => {
    const response = await call(markPaid, `/invoices/${invoiceId}/mark-paid`, {
      method: "POST",
      body: { method: "BANK_TRANSFER", reference: `${tag}-DEKONT` },
      params: { id: invoiceId },
    });
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data.invoice.status).toBe("PAID");
    const payment = await db.payment.findFirstOrThrow({ where: { invoiceId } });
    expect(payment).toMatchObject({ status: "COMPLETED", method: "BANK_TRANSFER", transactionId: `${tag}-DEKONT` });
    expect(Number(payment.amount)).toBe(120);
    expect(await db.domainEvent.count({ where: { type: "invoice.paid", aggregateId: invoiceId, actorId: staffId } })).toBe(1);

    const again = await call(markPaid, `/invoices/${invoiceId}/mark-paid`, { method: "POST", body: { method: "BANK_TRANSFER" }, params: { id: invoiceId } });
    expect(again.status).toBe(409);
  });

  it("shrinks when the owner is demoted and dies when deactivated", async () => {
    await db.user.update({ where: { id: staffId }, data: { role: "SUPPORT" } });
    const denied = await call(createCustomer, "/customers", { method: "POST", body: { email: `${tag}-x@test.local`, name: "X" } });
    expect(denied.status).toBe(403);
    expect((await denied.json()).error.code).toBe("insufficient_scope");
    expect((await call(listCustomers, `/customers?q=${tag}`)).status).toBe(200);

    await db.user.update({ where: { id: staffId }, data: { status: "SUSPENDED" } });
    expect((await call(listCustomers, "/customers")).status).toBe(401);
    await db.user.update({ where: { id: staffId }, data: { role: "ADMIN", status: "ACTIVE" } });
  });

  it("enforces the IP allowlist and expiry", async () => {
    const outside = await call(listCustomers, "/customers", { headers: { "x-forwarded-for": "203.0.113.1" } });
    expect(outside.status).toBe(403);

    await db.staffApiToken.update({ where: { id: tokenId }, data: { expiresAt: new Date(Date.now() - 1000) } });
    const expired = await call(listCustomers, "/customers");
    expect(expired.status).toBe(401);
    expect((await expired.json()).error.code).toBe("token_expired");
    await db.staffApiToken.update({ where: { id: tokenId }, data: { expiresAt: null } });
  });

  it("serves the OpenAPI document to a valid token only", async () => {
    const doc = await (await call(openapi, "/openapi.json")).json();
    expect(doc.openapi).toBe("3.1.0");
    expect(doc.paths["/customers"].get["x-required-permission"]).toBe("customers.view");
    expect((await call(openapi, "/openapi.json", { token: "kc_admin_nope" })).status).toBe(401);
  });

  it("wrote one audit row per call with a known token", async () => {
    const rows = await db.activityLog.findMany({
      where: { action: "ADMIN_API_REQUEST", entityId: tokenId },
      orderBy: { createdAt: "asc" },
    });
    // me, 3× list, 3× create, reply, 2× mark-paid, 2× demotion, suspended list, 2× ip/expiry, openapi = 16
    expect(rows).toHaveLength(16);
    expect(rows.every((row) => row.userId === staffId)).toBe(true);
    const statuses = rows.map((row) => (row.details as { status: number }).status);
    expect(statuses).toEqual([200, 200, 200, 400, 201, 201, 422, 201, 200, 409, 403, 200, 401, 403, 401, 200]);
    expect(rows.filter((row) => row.ipAddress === ip)).toHaveLength(15);
    expect(rows[1].details).toMatchObject({ method: "GET", endpoint: "/customers", operation: "listCustomers" });
  });
});
