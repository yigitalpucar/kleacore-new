/**
 * Bulk announcements against a real Postgres: audience queries (server
 * instance / Proxmox node, product, category, TLD), marketing opt-out,
 * idempotent throttled batches, cancel mid-way, resend to failed and the
 * unsubscribe link. The job queue is stubbed (no pg-boss jobs are created).
 * Skipped unless RUN_DB_TESTS=1 (local/dev database only):
 *
 *   RUN_DB_TESTS=1 pnpm vitest run src/lib/broadcasts/broadcasts.integration.test.ts
 */
import "dotenv/config";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/notifications/queue", () => ({ queueNotificationDelivery: vi.fn(async () => ({ queued: true })) }));
vi.mock("@/lib/provisioning/queue", () => ({ isJobQueueReady: vi.fn(async () => false) }));
vi.mock("@/lib/jobs/enqueue", () => ({ enqueue: vi.fn(async () => ({ id: "job", deduplicated: false })) }));

import type { BroadcastKind, Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { buildAudienceWhere, parseAudience, type AudienceFilterInput } from "./audience";
import { createUnsubscribeToken, setMarketingConsent, verifyUnsubscribeToken } from "./consent";
import { buildRecipients, cancelBroadcast, resendFailedRecipients, runBroadcastTick } from "./dispatch";
import { getRecipientCounts, recordBroadcastDelivery } from "./progress";
import { BROADCAST_RATE_KEY } from "./settings";

const enabled = process.env.RUN_DB_TESTS === "1";
const TAG = `bctest${Date.now().toString(36)}`;
const T0 = new Date("2030-01-01T10:00:00.000Z");
const at = (seconds: number) => new Date(T0.getTime() + seconds * 1000);
const noSchedule = vi.fn(async () => undefined);

describe.runIf(enabled)("broadcasts (integration, real Postgres)", () => {
  const ids = {
    users: [] as string[],
    instances: [] as string[],
    products: [] as string[],
    broadcasts: [] as string[],
  };
  let whm = "";
  let pve = "";
  let productA = "";
  let productB = "";
  let categoryA = "";
  const u: Record<string, string> = {};
  let previousRate: string | null = null;

  async function user(key: string, data: Partial<Prisma.UserCreateInput> = {}) {
    const row = await db.user.create({
      data: { email: `${TAG}-${key}@example.test`, password: "x", name: key, surname: "Test", ...data },
      select: { id: true },
    });
    ids.users.push(row.id);
    u[key] = row.id;
    return row.id;
  }

  async function audienceIds(filter: AudienceFilterInput, kind: BroadcastKind = "SERVICE") {
    const rows = await db.user.findMany({
      where: { AND: [buildAudienceWhere(parseAudience(filter), kind), { id: { in: ids.users } }] },
      select: { email: true },
    });
    return rows.map((row) => row.email.split("@")[0].replace(`${TAG}-`, "")).sort();
  }

  async function newBroadcast(kind: BroadcastKind, audience: AudienceFilterInput) {
    const row = await db.broadcast.create({
      data: {
        kind,
        subject: "Planlı bakım {{customer.firstName}}",
        bodyHtml: "<p>Merhaba {{customer.name}}</p>",
        channels: ["EMAIL"],
        audience: audience as Prisma.InputJsonValue,
        status: "SENDING",
        startedAt: T0,
      },
    });
    ids.broadcasts.push(row.id);
    return row.id;
  }

  async function setRate(rate: number) {
    await db.setting.upsert({ where: { key: BROADCAST_RATE_KEY }, create: { key: BROADCAST_RATE_KEY, value: String(rate) }, update: { value: String(rate) } });
  }

  beforeAll(async () => {
    vi.spyOn(console, "info").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
    previousRate = (await db.setting.findUnique({ where: { key: BROADCAST_RATE_KEY } }))?.value ?? null;

    const categories = await db.productCategory.findMany({ take: 2, orderBy: { displayOrder: "asc" }, select: { id: true } });
    categoryA = categories[0].id;
    const categoryB = categories[1]?.id ?? categoryA;
    productA = (await db.product.create({ data: { categoryId: categoryA, sku: `${TAG}-a`, name: `${TAG} A`, slug: `${TAG}-a` } })).id;
    productB = (await db.product.create({ data: { categoryId: categoryB, sku: `${TAG}-b`, name: `${TAG} B`, slug: `${TAG}-b` } })).id;
    ids.products.push(productA, productB);

    whm = (await db.moduleInstance.create({ data: { kind: "server", moduleId: "cpanel-whm", label: `${TAG} WHM-1` } })).id;
    pve = (await db.moduleInstance.create({ data: { kind: "server", moduleId: "proxmox", label: `${TAG} PVE` } })).id;
    ids.instances.push(whm, pve);

    await user("hosting"); // WHM, product A, .com.tr
    await user("vdsnode1", { marketingConsent: true, customerType: "CORPORATE" }); // PVE node-1, product B
    await user("vdsnode2", { marketingConsent: true }); // PVE node-2, product B
    await user("suspended", { status: "SUSPENDED" }); // WHM, product A
    await user("cancelledsvc"); // WHM, cancelled service
    await user("domainonly", { marketingConsent: true }); // .net domain, expired .com.tr

    const svc = (customerId: string, data: Partial<Prisma.ServiceUncheckedCreateInput>) =>
      db.service.create({ data: { customerId, productId: productA, ...data } });
    await svc(u.hosting, { moduleInstanceId: whm, remoteId: `${TAG}h1` });
    await svc(u.vdsnode1, { productId: productB, moduleInstanceId: pve, remoteId: `${TAG}101`, moduleData: { proxmox: { node: "node-1", vmid: 101 } } });
    await svc(u.vdsnode2, { productId: productB, moduleInstanceId: pve, remoteId: `${TAG}102`, moduleData: { proxmox: { node: "node-2", vmid: 102 } } });
    await svc(u.suspended, { moduleInstanceId: whm, remoteId: `${TAG}h2` });
    await svc(u.cancelledsvc, { moduleInstanceId: whm, remoteId: `${TAG}h3`, status: "CANCELLED" });

    const domain = (customerId: string, name: string, status: "ACTIVE" | "EXPIRED" = "ACTIVE") =>
      db.domain.create({ data: { customerId, name: `${TAG}-${name}`, expiresAt: at(86400 * 365), status } });
    await domain(u.hosting, "site.com.tr");
    await domain(u.domainonly, "shop.net");
    await domain(u.domainonly, "old.com.tr", "EXPIRED");
  });

  afterAll(async () => {
    await db.notificationLog.deleteMany({ where: { userId: { in: ids.users } } });
    await db.broadcast.deleteMany({ where: { id: { in: ids.broadcasts } } });
    await db.domainEvent.deleteMany({ where: { aggregateId: { in: [...ids.broadcasts, ...ids.users] } } });
    await db.emailMessage.deleteMany({ where: { customerId: { in: ids.users } } });
    await db.domain.deleteMany({ where: { customerId: { in: ids.users } } });
    await db.service.deleteMany({ where: { customerId: { in: ids.users } } });
    await db.user.deleteMany({ where: { id: { in: ids.users } } });
    await db.moduleInstance.deleteMany({ where: { id: { in: ids.instances } } });
    await db.product.deleteMany({ where: { id: { in: ids.products } } });
    if (previousRate === null) await db.setting.deleteMany({ where: { key: BROADCAST_RATE_KEY } });
    else await setRate(Number(previousRate));
  });

  describe("audience queries", () => {
    it("by server instance (active + suspended services of active customers)", async () => {
      expect(await audienceIds({ servers: [{ instanceId: whm }] })).toEqual(["hosting"]);
      expect(await audienceIds({ servers: [{ instanceId: whm }], userStatuses: ["ACTIVE", "SUSPENDED"] })).toEqual(["hosting", "suspended"]);
      expect(await audienceIds({ servers: [{ instanceId: whm }], serviceStatuses: ["CANCELLED"] })).toEqual(["cancelledsvc"]);
    });

    it("by Proxmox node", async () => {
      expect(await audienceIds({ servers: [{ instanceId: pve, node: "node-1" }] })).toEqual(["vdsnode1"]);
      expect(await audienceIds({ servers: [{ instanceId: pve }] })).toEqual(["vdsnode1", "vdsnode2"]);
      expect(await audienceIds({ servers: [{ instanceId: pve, node: "node-9" }] })).toEqual([]);
    });

    it("by product / category, matched on the same service as the server", async () => {
      expect(await audienceIds({ productIds: [productB] })).toEqual(["vdsnode1", "vdsnode2"]);
      expect(await audienceIds({ productIds: [productA], servers: [{ instanceId: pve }] })).toEqual([]);
      const byCategory = await audienceIds({ categoryIds: [categoryA] });
      expect(byCategory).toContain("hosting");
    });

    it("by domain TLD (live domains only) and customer type", async () => {
      expect(await audienceIds({ tlds: ["com.tr"] })).toEqual(["hosting"]);
      expect(await audienceIds({ tlds: ["net", ".COM.TR"] })).toEqual(["domainonly", "hosting"]);
      expect(await audienceIds({ productIds: [productB], customerTypes: ["CORPORATE"] })).toEqual(["vdsnode1"]);
    });

    it("marketing needs the opt-in, service notices ignore it", async () => {
      expect(await audienceIds({ servers: [{ instanceId: whm }, { instanceId: pve }] }, "SERVICE")).toEqual(["hosting", "vdsnode1", "vdsnode2"]);
      expect(await audienceIds({ servers: [{ instanceId: whm }, { instanceId: pve }] }, "MARKETING")).toEqual(["vdsnode1", "vdsnode2"]);
    });
  });

  describe("delivery", () => {
    it("throttles to the per-minute rate and never queues a recipient twice", async () => {
      await setRate(1);
      const id = await newBroadcast("SERVICE", { servers: [{ instanceId: whm }, { instanceId: pve }] });

      // Two ticks at the same moment (duplicate job): one batch only.
      const [first, second] = await Promise.all([
        runBroadcastTick(id, { now: at(0), schedule: noSchedule }),
        runBroadcastTick(id, { now: at(0), schedule: noSchedule }),
      ]);
      const statuses = [first.status, second.status].sort();
      expect(statuses).toEqual(["SENDING", "THROTTLED"]);
      expect((await getRecipientCounts(id)).QUEUED).toBe(1);

      // Within the minute: throttled. After it: the next batch.
      expect((await runBroadcastTick(id, { now: at(30), schedule: noSchedule })).status).toBe("THROTTLED");
      const third = await runBroadcastTick(id, { now: at(60), schedule: noSchedule });
      expect(third.dispatched?.queued).toBe(1);

      // A crashed/retried dispatch re-offering the same recipient: the dedupe key stops a second message.
      const queued = await db.broadcastRecipient.findFirstOrThrow({ where: { broadcastId: id, status: "QUEUED" } });
      await db.broadcastRecipient.update({ where: { id: queued.id }, data: { status: "PENDING" } });
      await db.broadcast.update({ where: { id }, data: { lastBatchAt: null } });
      await setRate(100);
      await runBroadcastTick(id, { now: at(120), schedule: noSchedule });
      const logs = await db.notificationLog.findMany({ where: { dedupeKey: { startsWith: `broadcast:${id}:` } } });
      const perRecipient = new Map<string, number>();
      for (const row of logs) perRecipient.set(row.dedupeKey!, (perRecipient.get(row.dedupeKey!) ?? 0) + 1);
      expect([...perRecipient.values()].every((count) => count === 1)).toBe(true);
      expect(logs).toHaveLength(3);
      expect(logs.every((row) => row.template === "broadcast.service" && row.status === "QUEUED")).toBe(true);

      // Personalised per recipient.
      const hostingLog = logs.find((row) => row.userId === u.hosting)!;
      expect(hostingLog.subject).toBe("Planlı bakım hosting");

      // Deliveries reported → completed.
      for (const row of logs) await recordBroadcastDelivery(row.id, "SENT", null);
      await db.broadcast.update({ where: { id }, data: { lastBatchAt: null } });
      const final = await runBroadcastTick(id, { now: at(180), schedule: noSchedule });
      expect(final.status).toBe("COMPLETED");
      expect((await getRecipientCounts(id)).SENT).toBe(3);
    });

    it("a scheduled broadcast waits for its time", async () => {
      const id = await newBroadcast("SERVICE", { productIds: [productB] });
      await db.broadcast.update({ where: { id }, data: { status: "SCHEDULED", startedAt: null, scheduledAt: at(3600) } });
      expect((await runBroadcastTick(id, { now: at(0), schedule: noSchedule })).status).toBe("WAITING");
      expect(noSchedule).toHaveBeenLastCalledWith(id, at(3600));
      expect(await db.broadcastRecipient.count({ where: { broadcastId: id } })).toBe(0);
      await cancelBroadcast(id);
    });

    it("marketing: honours an opt-out that happens after the list was built", async () => {
      await setRate(100);
      const id = await newBroadcast("MARKETING", { productIds: [productB] });
      expect(await buildRecipients(await db.broadcast.findUniqueOrThrow({ where: { id } }), at(0))).toEqual({ built: true, total: 2 });

      await setMarketingConsent(u.vdsnode2, false, { source: "panel" });
      const result = await runBroadcastTick(id, { now: at(0), schedule: noSchedule });
      expect(result.dispatched).toMatchObject({ queued: 1, skipped: 1 });
      const skipped = await db.broadcastRecipient.findFirstOrThrow({ where: { broadcastId: id, userId: u.vdsnode2 } });
      expect(skipped).toMatchObject({ status: "SKIPPED", error: "OPTED_OUT" });

      const log = await db.notificationLog.findFirstOrThrow({ where: { userId: u.vdsnode1, template: "broadcast.marketing" } });
      const data = log.data as Record<string, string>;
      expect(verifyUnsubscribeToken(new URL(data.unsubscribeUrl).searchParams.get("t"))).toBe(u.vdsnode1);
      expect(new URL(data.oneClickUrl).pathname).toBe("/api/abonelik/iptal");

      // Opt back in for the other tests.
      await setMarketingConsent(u.vdsnode2, true, { source: "panel" });
    });

    it("cancel mid-way: pending recipients and unsent queued messages are cancelled", async () => {
      await setRate(1);
      const id = await newBroadcast("SERVICE", { servers: [{ instanceId: whm }, { instanceId: pve }] });
      await runBroadcastTick(id, { now: at(0), schedule: noSchedule });
      expect(await getRecipientCounts(id)).toMatchObject({ QUEUED: 1, PENDING: 2 });

      const { cancelled } = await cancelBroadcast(id, at(10));
      expect(cancelled).toBe(3);
      expect(await getRecipientCounts(id)).toMatchObject({ CANCELLED: 3, PENDING: 0, QUEUED: 0 });
      const log = await db.notificationLog.findFirstOrThrow({ where: { dedupeKey: { startsWith: `broadcast:${id}:` } } });
      expect(log).toMatchObject({ status: "SKIPPED", error: "BROADCAST_CANCELLED" });

      // A tick that was already scheduled does nothing.
      expect((await runBroadcastTick(id, { now: at(120), schedule: noSchedule })).status).toBe("CANCELLED");
      expect(await db.notificationLog.count({ where: { dedupeKey: { startsWith: `broadcast:${id}:` } } })).toBe(1);
      await expect(cancelBroadcast(id)).rejects.toThrow("BROADCAST_NOT_CANCELLABLE");
    });

    it("resend to failed creates exactly one new message per failed recipient", async () => {
      await setRate(100);
      const id = await newBroadcast("SERVICE", { productIds: [productB] });
      await runBroadcastTick(id, { now: at(0), schedule: noSchedule });
      const logs = await db.notificationLog.findMany({ where: { dedupeKey: { startsWith: `broadcast:${id}:` } } });
      expect(logs).toHaveLength(2);
      await recordBroadcastDelivery(logs[0].id, "SENT", null);
      await recordBroadcastDelivery(logs[1].id, "FAILED", "SMTP 421");
      await db.broadcast.update({ where: { id }, data: { lastBatchAt: null } });
      expect((await runBroadcastTick(id, { now: at(60), schedule: noSchedule })).status).toBe("COMPLETED");

      expect(await resendFailedRecipients(id)).toEqual({ requeued: 1 });
      await db.broadcast.update({ where: { id }, data: { lastBatchAt: null } });
      await runBroadcastTick(id, { now: at(120), schedule: noSchedule });

      const after = await db.notificationLog.findMany({ where: { dedupeKey: { startsWith: `broadcast:${id}:` } }, orderBy: { createdAt: "asc" } });
      expect(after).toHaveLength(3);
      expect(after[2].dedupeKey).toMatch(/:1$/);
      expect(after[2].userId).toBe(logs[1].userId);
    });
  });

  describe("marketing consent", () => {
    it("records consent and revokes it via the signed link", async () => {
      const id = await user("optin");
      await setMarketingConsent(id, true, { source: "panel", ipAddress: "203.0.113.5" });
      const granted = await db.consentRecord.findFirstOrThrow({ where: { userId: id, documentType: "MARKETING_CONSENT" } });
      expect(granted).toMatchObject({ revokedAt: null, ipAddress: "203.0.113.5" });
      expect(granted.snapshot).toContain("6563");

      // Setting the same value again changes nothing.
      expect((await setMarketingConsent(id, true, { source: "panel" })).changed).toBe(false);

      const fromLink = verifyUnsubscribeToken(createUnsubscribeToken(id));
      expect(fromLink).toBe(id);
      expect((await setMarketingConsent(fromLink!, false, { source: "unsubscribe_link" })).changed).toBe(true);
      const after = await db.user.findUniqueOrThrow({ where: { id }, select: { marketingConsent: true } });
      expect(after.marketingConsent).toBe(false);
      const revoked = await db.consentRecord.findUniqueOrThrow({ where: { id: granted.id } });
      expect(revoked.revokedAt).not.toBeNull();
    });
  });
});
