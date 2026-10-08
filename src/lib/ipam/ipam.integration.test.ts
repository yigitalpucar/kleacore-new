/**
 * IPAM against a real Postgres (row locks, advisory locks, unique index).
 * Skipped unless RUN_DB_TESTS=1; uses DATABASE_URL from .env — a local/dev
 * database, never production:
 *
 *   pnpm test:db
 */
import "dotenv/config";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { db } from "@/lib/db";
import { IpamError, allocateIp, createIpPool, releaseIp } from "./index";

const enabled = process.env.RUN_DB_TESTS === "1";

describe.runIf(enabled)("IPAM (integration, real Postgres)", () => {
  // TEST-NET-3 (RFC 5737), never routed: safe for a test pool.
  const cidr = "203.0.113.0/27";
  const tag = `itest-${randomUUID().slice(0, 8)}`;
  let poolId = "";
  const serviceIds: string[] = [];
  let customerId = "";
  let productId = "";

  beforeAll(async () => {
    const stale = await db.ipPool.findMany({ where: { cidr }, select: { id: true } });
    await db.ipPool.deleteMany({ where: { id: { in: stale.map((pool) => pool.id) } } });

    const product = await db.product.findFirstOrThrow({ select: { id: true } });
    const customer = await db.user.create({
      data: { email: `${tag}@test.local`, name: "IPAM", surname: "Test", password: "x" },
    });
    customerId = customer.id;
    productId = product.id;

    for (let i = 0; i < 40; i++) {
      const service = await db.service.create({
        data: { customerId, productId, label: `${tag}-${i}`, status: "ACTIVE" },
      });
      serviceIds.push(service.id);
    }

    const { pool, addressCount, reservedCount } = await createIpPool({
      name: tag,
      cidr,
      gateway: "203.0.113.1",
      reservedRanges: "203.0.113.2-203.0.113.3",
      dnsServers: ["1.1.1.1"],
    });
    poolId = pool.id;
    expect(addressCount).toBe(29); // 32 - network - broadcast - gateway
    expect(reservedCount).toBe(2);
  });

  afterAll(async () => {
    await db.ipPool.deleteMany({ where: { id: poolId } });
    await db.service.deleteMany({ where: { id: { in: serviceIds } } });
    await db.user.deleteMany({ where: { id: customerId } });
  });

  it("rejects an overlapping pool", async () => {
    await expect(createIpPool({ name: "overlap", cidr: "203.0.113.16/28", gateway: "203.0.113.17" })).rejects.toMatchObject({
      code: "POOL_OVERLAP",
    });
  });

  it("allocates the lowest free address, skipping reserved ones, idempotently per service", async () => {
    const first = await allocateIp(poolId, serviceIds[0]);
    expect(first.address).toBe("203.0.113.4");
    expect((await allocateIp(poolId, serviceIds[0])).id).toBe(first.id);
  });

  it("never hands one address to two services under concurrency, and stops at exhaustion", async () => {
    const contenders = serviceIds.slice(1); // 39 services for 26 remaining addresses
    const results = await Promise.allSettled(contenders.map((serviceId) => allocateIp(poolId, serviceId)));

    const won = results.filter((r): r is PromiseFulfilledResult<Awaited<ReturnType<typeof allocateIp>>> => r.status === "fulfilled");
    const lost = results.filter((r): r is PromiseRejectedResult => r.status === "rejected");
    expect(won).toHaveLength(26);
    expect(new Set(won.map((r) => r.value.address)).size).toBe(26);
    expect(lost).toHaveLength(13);
    for (const failure of lost) {
      expect(failure.reason).toBeInstanceOf(IpamError);
      expect(failure.reason.code).toBe("POOL_EXHAUSTED");
    }

    const assigned = await db.ipAddress.findMany({ where: { poolId, status: "ASSIGNED" } });
    expect(assigned).toHaveLength(27);
    expect(new Set(assigned.map((a) => a.serviceId)).size).toBe(27);
    expect(await db.ipAddress.count({ where: { poolId, status: "RESERVED" } })).toBe(2);
  });

  async function serviceWithoutAddress() {
    const holders = new Set((await db.ipAddress.findMany({ where: { poolId, serviceId: { not: null } } })).map((a) => a.serviceId));
    return serviceIds.find((id) => !holders.has(id))!;
  }

  it("concurrent allocations for the same service return one address", async () => {
    const holder = await db.ipAddress.findFirstOrThrow({ where: { poolId, status: "ASSIGNED", serviceId: { not: serviceIds[0] } } });
    expect(await releaseIp(holder.serviceId!)).toEqual([holder.address]);

    const target = await serviceWithoutAddress();
    const same = await Promise.all(Array.from({ length: 5 }, () => allocateIp(poolId, target)));
    expect(new Set(same.map((a) => a.id)).size).toBe(1);
    expect(same[0].address).toBe(holder.address);
    expect(await db.ipAddress.count({ where: { poolId, serviceId: target } })).toBe(1);
  });

  it("release honours the pool cool-down", async () => {
    await db.ipPool.update({ where: { id: poolId }, data: { releaseCooldownMinutes: 60 } });
    const held = await db.ipAddress.findFirstOrThrow({ where: { poolId, status: "ASSIGNED", serviceId: { not: serviceIds[0] } } });
    await releaseIp(held.serviceId!);

    const freed = await db.ipAddress.findUniqueOrThrow({ where: { id: held.id } });
    expect(freed).toMatchObject({ status: "FREE", serviceId: null });
    expect(freed.cooldownUntil!.getTime()).toBeGreaterThan(Date.now() + 59 * 60_000);

    // The only free address is cooling down: nothing can be handed out.
    await expect(allocateIp(poolId, await serviceWithoutAddress())).rejects.toMatchObject({ code: "POOL_EXHAUSTED" });
  });
});
