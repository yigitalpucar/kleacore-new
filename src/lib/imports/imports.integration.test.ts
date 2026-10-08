/**
 * Import apply against a real Postgres (unique constraint, per-row
 * transactions, IPAM). Skipped unless RUN_DB_TESTS=1; uses DATABASE_URL from
 * .env — a local/dev database, never production:
 *
 *   pnpm test:db
 */
import "dotenv/config";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
import type { Prisma } from "@prisma/client";

vi.mock("./invite", () => ({ sendAccountInvite: vi.fn(async () => ({ ok: true, logIds: [], deduplicated: false })) }));

import { db } from "@/lib/db";
import { createIpPool } from "@/lib/ipam";
import { runImportApply } from "./apply";
import { sendAccountInvite } from "./invite";
import type { ImportProposal, ImportRecord } from "./types";

const enabled = process.env.RUN_DB_TESTS === "1";

describe.runIf(enabled)("import apply (integration, real Postgres)", () => {
  const tag = `imp-${randomUUID().slice(0, 8)}`;
  const cidr = "203.0.113.64/28"; // TEST-NET-3, never routed
  let instanceId = "";
  let poolId = "";
  let customerId = "";
  let otherServiceId = "";
  let hostingProductId = "";
  let vdsProductId = "";
  const runIds: string[] = [];

  const due = "2030-01-15";
  const proposal = (overrides: Partial<ImportProposal> = {}): ImportProposal => ({
    action: "import",
    customer: { mode: "existing", userId: customerId, email: `${tag}@test.local`, label: "x", matchedBy: "email" },
    productId: hostingProductId,
    productMatchedBy: "package",
    billingPeriod: "yearly",
    nextDueDate: due,
    amountOverride: null,
    serviceStatus: "ACTIVE",
    domainStatus: "ACTIVE",
    autoRenew: true,
    linkServiceId: null,
    existingId: null,
    notes: [],
    ...overrides,
  });
  const account = (user: string, extra: Partial<Extract<ImportRecord, { kind: "account" }>> = {}): ImportRecord => ({
    kind: "account",
    remoteId: `${tag}-${user}`,
    username: `${tag}-${user}`,
    domain: `${user}.${tag}.test`,
    email: null,
    plan: "x",
    diskUsedMB: 1024,
    diskLimitMB: 2048,
    suspended: false,
    suspendReason: null,
    createdAt: null,
    ipAddresses: ["192.0.2.10"],
    ...extra,
  });

  async function createRun(rows: Array<{ record: ImportRecord; proposal: ImportProposal }>) {
    const admin = await db.user.findFirst({ where: { role: "ADMIN" }, select: { id: true } });
    const run = await db.importRun.create({
      data: {
        source: "WHM",
        moduleInstanceId: instanceId,
        instanceLabel: tag,
        status: "IMPORTING",
        appliedById: admin?.id ?? null,
        rows: {
          create: rows.map(({ record, proposal }) => ({
            remoteId: record.remoteId,
            label: record.remoteId,
            data: record as unknown as Prisma.InputJsonValue,
            proposal: proposal as unknown as Prisma.InputJsonValue,
            selected: true,
          })),
        },
      },
    });
    runIds.push(run.id);
    return run.id;
  }

  beforeAll(async () => {
    const stale = await db.ipPool.findMany({ where: { cidr }, select: { id: true } });
    await db.ipPool.deleteMany({ where: { id: { in: stale.map((p) => p.id) } } });

    hostingProductId = (await db.product.findFirstOrThrow({ where: { category: { slug: "hosting" } }, select: { id: true } })).id;
    vdsProductId = (await db.product.findFirstOrThrow({ where: { category: { slug: { in: ["vds", "vps", "server"] } } }, select: { id: true } })).id;
    const instance = await db.moduleInstance.create({ data: { kind: "server", moduleId: "cpanel-whm", label: tag, config: {} } });
    instanceId = instance.id;
    customerId = (await db.user.create({ data: { email: `${tag}@test.local`, name: "Import", surname: "Test", password: "x" } })).id;
    otherServiceId = (await db.service.create({ data: { customerId, productId: vdsProductId, label: `${tag}-other` } })).id;

    const { pool } = await createIpPool({ name: tag, cidr, gateway: "203.0.113.65", dnsServers: ["1.1.1.1"], moduleInstanceId: instanceId });
    poolId = pool.id;
    await db.ipAddress.update({ where: { address: "203.0.113.67" }, data: { status: "ASSIGNED", serviceId: otherServiceId } });
  });

  afterAll(async () => {
    const services = await db.service.findMany({ where: { OR: [{ moduleInstanceId: instanceId }, { id: otherServiceId }] }, select: { id: true } });
    await db.ipPool.deleteMany({ where: { id: poolId } });
    await db.service.deleteMany({ where: { id: { in: services.map((s) => s.id) } } });
    await db.domain.deleteMany({ where: { name: { endsWith: `${tag}.test` } } });
    await db.importRun.deleteMany({ where: { id: { in: runIds } } });
    await db.moduleInstance.deleteMany({ where: { id: instanceId } });
    await db.user.deleteMany({ where: { email: { startsWith: tag } } });
  });

  it("imports selected rows, isolates row errors, assigns pool IPs without reassigning", async () => {
    const runId = await createRun([
      { record: account("ok"), proposal: proposal() },
      {
        record: account("susp", { suspended: true, email: `${tag}-new@test.local` }),
        proposal: proposal({ serviceStatus: "SUSPENDED", customer: { mode: "new", email: `${tag}-new@test.local`, name: "Yeni", surname: "Müşteri" }, amountOverride: "99.90" }),
      },
      { record: account("noproduct"), proposal: proposal({ productId: null }) },
      { record: account("past"), proposal: proposal({ nextDueDate: "2020-01-01" }) },
      {
        record: {
          kind: "vm",
          remoteId: `${tag}-101`,
          name: `vm.${tag}.test`,
          node: "pve1",
          status: "running",
          cores: 2,
          memoryMB: 2048,
          diskGB: 40,
          ipAddresses: ["203.0.113.66", "203.0.113.67", "198.51.100.1"],
          createdAt: null,
        },
        proposal: proposal({ productId: vdsProductId, billingPeriod: "monthly" }),
      },
      {
        record: { kind: "domain", remoteId: `dom.${tag}.test`, name: `dom.${tag}.test`, expiresAt: null, status: "active", nameservers: ["ns1.kleacore.com"], autoRenew: false },
        proposal: proposal({ nextDueDate: "2025-06-01", domainStatus: "EXPIRED", autoRenew: false }),
      },
    ]);

    await runImportApply(runId);

    const run = await db.importRun.findUniqueOrThrow({ where: { id: runId }, include: { rows: true } });
    expect(run).toMatchObject({ status: "COMPLETED", importedCount: 4, failedCount: 2, createdCustomers: 1 });
    const byRemote = new Map(run.rows.map((r) => [r.remoteId, r]));
    expect(byRemote.get(`${tag}-noproduct`)).toMatchObject({ status: "FAILED", error: "Ürün seçilmedi." });
    expect(byRemote.get(`${tag}-past`)?.error).toMatch(/bugünden önce/);

    const ok = await db.service.findUniqueOrThrow({ where: { id: byRemote.get(`${tag}-ok`)!.serviceId! } });
    expect(ok).toMatchObject({ moduleInstanceId: instanceId, remoteId: `${tag}-ok`, username: `${tag}-ok`, status: "ACTIVE", billingPeriod: "yearly", diskLimit: 2 });
    expect(ok.nextDueDate?.toISOString().slice(0, 10)).toBe(due);
    // WHM shared IP is stored on the service but not claimed in IPAM
    expect(ok.ipAddress).toBe("192.0.2.10");

    const susp = await db.service.findUniqueOrThrow({ where: { id: byRemote.get(`${tag}-susp`)!.serviceId! }, include: { customer: true } });
    expect(susp).toMatchObject({ status: "SUSPENDED", suspendReason: "İçe aktarma" });
    expect(susp.amount.toFixed(2)).toBe("99.90");
    expect(susp.customer).toMatchObject({ email: `${tag}-new@test.local`, role: "CUSTOMER" });
    expect(susp.customer.password).not.toBe("");
    expect(sendAccountInvite).toHaveBeenCalledWith(susp.customerId, expect.objectContaining({ runId }));

    const vmRow = byRemote.get(`${tag}-101`)!;
    expect(vmRow.status).toBe("IMPORTED");
    expect(vmRow.warnings).toEqual(["203.0.113.67 başka bir hizmete atanmış; değiştirilmedi."]);
    const ips = await db.ipAddress.findMany({ where: { address: { in: ["203.0.113.66", "203.0.113.67"] } }, orderBy: { sortKey: "asc" } });
    expect(ips.map((ip) => [ip.address, ip.status, ip.serviceId])).toEqual([
      ["203.0.113.66", "ASSIGNED", vmRow.serviceId],
      ["203.0.113.67", "ASSIGNED", otherServiceId],
    ]);

    const domain = await db.domain.findUniqueOrThrow({ where: { name: `dom.${tag}.test` } });
    expect(domain).toMatchObject({ moduleInstanceId: instanceId, status: "EXPIRED", autoRenew: false, customerId });

    // No invoices / provisioning jobs for imported services
    const serviceIds = run.rows.map((r) => r.serviceId).filter((id): id is string => Boolean(id));
    expect(await db.provisioningJob.count({ where: { serviceId: { in: serviceIds } } })).toBe(0);
    expect(await db.invoice.count({ where: { order: { serviceId: { in: serviceIds } } } })).toBe(0);
  });

  it("is idempotent: importing the same remote ids again skips them", async () => {
    const before = await db.service.count({ where: { moduleInstanceId: instanceId } });
    const runId = await createRun([
      { record: account("ok"), proposal: proposal() },
      { record: { kind: "domain", remoteId: `dom.${tag}.test`, name: `dom.${tag}.test`, expiresAt: null, status: null, nameservers: [], autoRenew: null }, proposal: proposal({ nextDueDate: "2027-01-01" }) },
    ]);
    await runImportApply(runId);

    const run = await db.importRun.findUniqueOrThrow({ where: { id: runId }, include: { rows: true } });
    expect(run).toMatchObject({ status: "COMPLETED", importedCount: 0, skippedCount: 2 });
    expect(await db.service.count({ where: { moduleInstanceId: instanceId } })).toBe(before);
  });

  it("the database refuses two services for one remote account", async () => {
    await expect(
      db.service.create({ data: { customerId, productId: hostingProductId, moduleInstanceId: instanceId, remoteId: `${tag}-ok` } })
    ).rejects.toMatchObject({ code: "P2002" });
  });
});
