"use server";

import { revalidatePath } from "next/cache";
import { logActivity } from "@/lib/activity-log";
import { db } from "@/lib/db";
import {
  IpamError,
  assignIpManually,
  createIpPool,
  releaseIpAddress,
  reserveIpAddress,
} from "@/lib/ipam";
import { splitList } from "@/lib/modules/schema-form";
import { createLogger } from "@/lib/logger";
import { requirePermission } from "@/lib/utils/auth-helpers";

const log = createLogger("actions.admin.ip-pools");
const POOLS_PATH = "/yonetim/ip-havuzlari";

type ActionResult<T = object> = ({ success: true } & T) | { success: false; error: string };

function failure(error: unknown, fallback: string): { success: false; error: string } {
  if (error instanceof IpamError) return { success: false, error: error.message };
  log.error(fallback, { error });
  return { success: false, error: fallback };
}

export interface CreateIpPoolFormInput {
  name: string;
  cidr: string;
  gateway: string;
  dnsServers: string;
  vlan: string;
  moduleInstanceId: string | null;
  reservedRanges: string;
  releaseCooldownMinutes: string;
  notes: string;
}

export async function createIpPoolAction(input: CreateIpPoolFormInput): Promise<ActionResult<{ id: string; addressCount: number }>> {
  const session = await requirePermission("provisioning.manage");
  const vlan = input.vlan.trim() ? Number(input.vlan) : null;
  if (vlan !== null && (!Number.isInteger(vlan) || vlan < 1 || vlan > 4094)) {
    return { success: false, error: "VLAN 1–4094 arası tam sayı olmalı." };
  }
  const cooldown = input.releaseCooldownMinutes.trim() ? Number(input.releaseCooldownMinutes) : 0;
  if (!Number.isInteger(cooldown) || cooldown < 0) return { success: false, error: "Bekleme süresi dakika cinsinden tam sayı olmalı." };

  try {
    const { pool, addressCount, reservedCount } = await createIpPool({
      name: input.name,
      cidr: input.cidr,
      gateway: input.gateway.trim(),
      dnsServers: splitList(input.dnsServers),
      vlan,
      moduleInstanceId: input.moduleInstanceId,
      reservedRanges: input.reservedRanges,
      releaseCooldownMinutes: cooldown,
      notes: input.notes,
    });
    await logActivity({
      userId: session.user.id,
      action: "IP_POOL_CREATE",
      entity: "IpPool",
      entityId: pool.id,
      details: { cidr: pool.cidr, addressCount, reservedCount },
    });
    revalidatePath(POOLS_PATH);
    return { success: true, id: pool.id, addressCount };
  } catch (error) {
    return failure(error, "IP havuzu oluşturulamadı.");
  }
}

/**
 * Service by id, or by exact domain / username / remote id when that matches
 * exactly one service.
 */
async function findServiceByReference(reference: string) {
  const ref = reference.trim();
  if (!ref) return null;
  const byId = await db.service.findUnique({ where: { id: ref }, select: { id: true, ipAddress: true } });
  if (byId) return byId;
  const matches = await db.service.findMany({
    where: { OR: [{ domain: ref.toLowerCase() }, { username: ref }, { remoteId: ref }] },
    select: { id: true, ipAddress: true },
    take: 2,
  });
  return matches.length === 1 ? matches[0] : null;
}

export async function assignIpAddressAction(addressId: string, serviceReference: string): Promise<ActionResult> {
  const session = await requirePermission("provisioning.manage");
  const service = await findServiceByReference(serviceReference);
  if (!service) return { success: false, error: "Hizmet bulunamadı (hizmet no, alan adı, kullanıcı adı veya uzak kimlik girin)." };

  try {
    const address = await assignIpManually(addressId, service.id);
    if (!service.ipAddress) {
      await db.service.update({ where: { id: service.id }, data: { ipAddress: address.address } });
    }
    await logActivity({
      userId: session.user.id,
      action: "IP_ASSIGN",
      entity: "IpAddress",
      entityId: addressId,
      details: { address: address.address, serviceId: service.id },
    });
    revalidatePath(`${POOLS_PATH}/${address.poolId}`);
    revalidatePath(POOLS_PATH);
    return { success: true };
  } catch (error) {
    return failure(error, "IP adresi atanamadı.");
  }
}

export async function releaseIpAddressAction(addressId: string): Promise<ActionResult> {
  const session = await requirePermission("provisioning.manage");
  try {
    const address = await db.ipAddress.findUnique({ where: { id: addressId }, select: { poolId: true, address: true, serviceId: true } });
    if (!address) return { success: false, error: "Adres bulunamadı." };
    await releaseIpAddress(addressId);
    await logActivity({
      userId: session.user.id,
      action: "IP_RELEASE",
      entity: "IpAddress",
      entityId: addressId,
      details: { address: address.address, serviceId: address.serviceId },
    });
    revalidatePath(`${POOLS_PATH}/${address.poolId}`);
    revalidatePath(POOLS_PATH);
    return { success: true };
  } catch (error) {
    return failure(error, "IP adresi serbest bırakılamadı.");
  }
}

export async function reserveIpAddressAction(addressId: string, notes: string): Promise<ActionResult> {
  const session = await requirePermission("provisioning.manage");
  try {
    const address = await db.ipAddress.findUnique({ where: { id: addressId }, select: { poolId: true, address: true } });
    if (!address) return { success: false, error: "Adres bulunamadı." };
    await reserveIpAddress(addressId, notes);
    await logActivity({ userId: session.user.id, action: "IP_RESERVE", entity: "IpAddress", entityId: addressId, details: { address: address.address } });
    revalidatePath(`${POOLS_PATH}/${address.poolId}`);
    revalidatePath(POOLS_PATH);
    return { success: true };
  } catch (error) {
    return failure(error, "IP adresi ayrılamadı.");
  }
}

export async function deleteIpPoolAction(poolId: string): Promise<ActionResult> {
  const session = await requirePermission("provisioning.manage");
  const assigned = await db.ipAddress.count({ where: { poolId, status: "ASSIGNED" } });
  if (assigned > 0) return { success: false, error: `Havuzda ${assigned} atanmış adres var; önce serbest bırakın.` };
  const pool = await db.ipPool.delete({ where: { id: poolId } }).catch(() => null);
  if (!pool) return { success: false, error: "Havuz bulunamadı." };
  await logActivity({ userId: session.user.id, action: "IP_POOL_DELETE", entity: "IpPool", entityId: poolId, details: { cidr: pool.cidr } });
  revalidatePath(POOLS_PATH);
  return { success: true };
}
