/**
 * Mini IPAM (Faz 2.4): IPv4 pools expanded into one IpAddress row per
 * address. Allocation is transactional and never hands one address to two
 * services:
 *  - the candidate row is picked with SELECT … FOR UPDATE SKIP LOCKED, so
 *    concurrent allocations skip each other's rows instead of waiting/racing;
 *  - the UPDATE re-checks status = FREE (belt and braces);
 *  - a per-service advisory lock makes allocateIp idempotent per
 *    (pool, service) even when two jobs for the same service run at once.
 * Docs: docs/modules.md → "IP havuzları".
 */
import { Prisma, type IpAddress } from "@prisma/client";
import { db } from "@/lib/db";
import { CidrError, cidrContains, expandCidr, parseCidr, parseIpRanges, isIpv4 } from "./cidr";

type Tx = Prisma.TransactionClient;

export class IpamError extends Error {
  constructor(
    readonly code:
      | "POOL_NOT_FOUND"
      | "POOL_EXHAUSTED"
      | "IP_NOT_FREE"
      | "IP_NOT_FOUND"
      | "POOL_OVERLAP"
      | "INVALID_INPUT",
    message: string
  ) {
    super(message);
    this.name = "IpamError";
  }
}

export interface CreateIpPoolInput {
  name: string;
  cidr: string;
  gateway: string;
  dnsServers?: string[];
  vlan?: number | null;
  moduleInstanceId?: string | null;
  /** "a-b, c" ranges inside the block to mark RESERVED. */
  reservedRanges?: string;
  releaseCooldownMinutes?: number;
  notes?: string | null;
}

/** Creates a pool and its address rows in one transaction. */
export async function createIpPool(input: CreateIpPoolInput) {
  const name = input.name.trim();
  if (!name) throw new IpamError("INVALID_INPUT", "Havuz adı gerekli.");

  let parsed;
  let addresses;
  try {
    parsed = parseCidr(input.cidr);
    if (!isIpv4(input.gateway) || !cidrContains(parsed, input.gateway)) {
      throw new CidrError(`Ağ geçidi ${input.gateway} bu blokta değil (${parsed.cidr}).`);
    }
    for (const dns of input.dnsServers ?? []) {
      if (!isIpv4(dns)) throw new CidrError(`Geçersiz DNS sunucusu: ${dns}`);
    }
    addresses = expandCidr(parsed.cidr, {
      gateway: input.gateway,
      reservedRanges: input.reservedRanges ? parseIpRanges(input.reservedRanges) : [],
    });
  } catch (error) {
    if (error instanceof CidrError) throw new IpamError("INVALID_INPUT", error.message);
    throw error;
  }

  return db.$transaction(async (tx) => {
    const overlapping = await tx.ipAddress.count({
      where: { sortKey: { gte: BigInt(parsed.networkInt), lte: BigInt(parsed.broadcastInt) } },
    });
    if (overlapping > 0) {
      throw new IpamError("POOL_OVERLAP", `${parsed.cidr} içindeki ${overlapping} adres zaten başka bir havuzda.`);
    }

    const pool = await tx.ipPool.create({
      data: {
        name,
        cidr: parsed.cidr,
        gateway: input.gateway.trim(),
        prefix: parsed.prefix,
        netmask: parsed.netmask,
        dnsServers: input.dnsServers ?? [],
        vlan: input.vlan ?? null,
        moduleInstanceId: input.moduleInstanceId || null,
        releaseCooldownMinutes: Math.max(0, Math.trunc(input.releaseCooldownMinutes ?? 0)),
        notes: input.notes?.trim() || null,
      },
    });

    await tx.ipAddress.createMany({
      data: addresses.map((address) => ({
        poolId: pool.id,
        address: address.address,
        sortKey: BigInt(address.sortKey),
        status: address.reserved ? "RESERVED" : "FREE",
        notes: address.reserved ? "Havuz oluşturulurken ayrıldı" : null,
      })),
    });

    return { pool, addressCount: addresses.length, reservedCount: addresses.filter((a) => a.reserved).length };
  });
}

async function lockService(tx: Tx, serviceId: string) {
  // Serialises allocations for one service (idempotency), not for the pool.
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`ipam:${serviceId}`}))`;
}

async function allocateInTx(tx: Tx, poolId: string, serviceId: string): Promise<IpAddress> {
  await lockService(tx, serviceId);

  const existing = await tx.ipAddress.findFirst({
    where: { poolId, serviceId, status: "ASSIGNED" },
    orderBy: { sortKey: "asc" },
  });
  if (existing) return existing;

  const pool = await tx.ipPool.findUnique({ where: { id: poolId }, select: { id: true } });
  if (!pool) throw new IpamError("POOL_NOT_FOUND", `IP havuzu bulunamadı: ${poolId}`);

  const candidates = await tx.$queryRaw<Array<{ id: string }>>`
    SELECT "id" FROM "ip_addresses"
    WHERE "poolId" = ${poolId}
      AND "status" = 'FREE'::"IpAddressStatus"
      AND ("cooldownUntil" IS NULL OR "cooldownUntil" <= now())
    ORDER BY "sortKey"
    LIMIT 1
    FOR UPDATE SKIP LOCKED`;
  const candidate = candidates[0];
  if (!candidate) throw new IpamError("POOL_EXHAUSTED", "Havuzda boş IP adresi kalmadı.");

  const now = new Date();
  const claimed = await tx.ipAddress.updateMany({
    where: { id: candidate.id, status: "FREE" },
    data: { status: "ASSIGNED", serviceId, assignedAt: now, releasedAt: null, cooldownUntil: null },
  });
  if (claimed.count !== 1) throw new IpamError("IP_NOT_FREE", "IP adresi başka bir işlem tarafından alındı.");

  return tx.ipAddress.findUniqueOrThrow({ where: { id: candidate.id } });
}

/**
 * Assigns the lowest free address of the pool to the service and returns it.
 * Idempotent: a service that already holds an address in this pool gets the
 * same one back. Pass `tx` to join an outer transaction.
 */
export async function allocateIp(poolId: string, serviceId: string, options: { tx?: Tx } = {}) {
  if (options.tx) return allocateInTx(options.tx, poolId, serviceId);
  return db.$transaction((tx) => allocateInTx(tx, poolId, serviceId));
}

/**
 * Frees every address held by the service (termination). Each address
 * becomes allocatable again after its pool's releaseCooldownMinutes.
 * Returns the released addresses.
 */
export async function releaseIp(serviceId: string, options: { tx?: Tx; poolId?: string } = {}) {
  const run = async (tx: Tx) => {
    const held = await tx.ipAddress.findMany({
      where: { serviceId, status: "ASSIGNED", ...(options.poolId ? { poolId: options.poolId } : {}) },
      include: { pool: { select: { releaseCooldownMinutes: true } } },
    });
    const now = new Date();
    for (const address of held) {
      const cooldown = address.pool.releaseCooldownMinutes;
      await tx.ipAddress.updateMany({
        where: { id: address.id, serviceId, status: "ASSIGNED" },
        data: {
          status: "FREE",
          serviceId: null,
          releasedAt: now,
          cooldownUntil: cooldown > 0 ? new Date(now.getTime() + cooldown * 60_000) : null,
        },
      });
    }
    return held.map((address) => address.address);
  };
  return options.tx ? run(options.tx) : db.$transaction(run);
}

/** Admin: give a specific FREE address to a service. */
export async function assignIpManually(addressId: string, serviceId: string) {
  const now = new Date();
  const claimed = await db.ipAddress.updateMany({
    where: { id: addressId, status: "FREE" },
    data: { status: "ASSIGNED", serviceId, assignedAt: now, releasedAt: null, cooldownUntil: null },
  });
  if (claimed.count !== 1) throw new IpamError("IP_NOT_FREE", "Adres boşta değil (atanmış veya ayrılmış).");
  return db.ipAddress.findUniqueOrThrow({ where: { id: addressId } });
}

/** Admin: release one address (no cool-down: an admin decided). */
export async function releaseIpAddress(addressId: string) {
  const updated = await db.ipAddress.updateMany({
    where: { id: addressId, status: { in: ["ASSIGNED", "RESERVED"] } },
    data: { status: "FREE", serviceId: null, releasedAt: new Date(), cooldownUntil: null },
  });
  if (updated.count !== 1) throw new IpamError("IP_NOT_FOUND", "Adres zaten boşta.");
}

/** Admin: mark a FREE address RESERVED (not handed out). */
export async function reserveIpAddress(addressId: string, notes?: string | null) {
  const updated = await db.ipAddress.updateMany({
    where: { id: addressId, status: "FREE" },
    data: { status: "RESERVED", notes: notes?.trim() || null },
  });
  if (updated.count !== 1) throw new IpamError("IP_NOT_FREE", "Yalnızca boştaki adres ayrılabilir.");
}

export interface IpPoolUsage {
  total: number;
  free: number;
  assigned: number;
  reserved: number;
}

export async function getIpPoolUsage(poolIds?: string[]): Promise<Map<string, IpPoolUsage>> {
  const rows = await db.ipAddress.groupBy({
    by: ["poolId", "status"],
    where: poolIds ? { poolId: { in: poolIds } } : undefined,
    _count: { _all: true },
  });
  const usage = new Map<string, IpPoolUsage>();
  for (const row of rows) {
    const entry = usage.get(row.poolId) ?? { total: 0, free: 0, assigned: 0, reserved: 0 };
    const count = row._count._all;
    entry.total += count;
    if (row.status === "FREE") entry.free += count;
    if (row.status === "ASSIGNED") entry.assigned += count;
    if (row.status === "RESERVED") entry.reserved += count;
    usage.set(row.poolId, entry);
  }
  return usage;
}

/** Pools bound to a server module instance, oldest first (a Proxmox module allocates from these). */
export async function listPoolsForInstance(moduleInstanceId: string) {
  return db.ipPool.findMany({ where: { moduleInstanceId }, orderBy: { createdAt: "asc" } });
}

export { CidrError, parseCidr, expandCidr, parseIpRanges, MAX_POOL_ADDRESSES } from "./cidr";
