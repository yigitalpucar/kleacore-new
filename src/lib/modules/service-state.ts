/**
 * Service.moduleData access: module-owned per-service state namespaced by
 * moduleId ({ "proxmox": { vmid, step, … } }). Server-only.
 *
 * The blob may hold encrypted secrets (enc:v1:… initial passwords); never
 * pass a Service row with moduleData to a client component — pick fields or
 * use `omitModuleData`.
 */
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import type { ServerModuleState } from "./contracts";

type DbClient = Prisma.TransactionClient | typeof db;

export type ModuleDataBlob = Record<string, Record<string, unknown>>;

function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

/** The module's slice of a moduleData value (any shape → object). */
export function moduleSlice(moduleData: unknown, moduleId: string): Record<string, unknown> {
  return asObject(asObject(moduleData)[moduleId]);
}

export async function readServiceModuleState(serviceId: string, moduleId: string, client: DbClient = db) {
  const row = await client.service.findUnique({ where: { id: serviceId }, select: { moduleData: true } });
  return moduleSlice(row?.moduleData, moduleId);
}

/**
 * Shallow-merges `patch` into moduleData[moduleId]; `undefined` removes a key.
 * Read-modify-write under a row lock so two writers of different modules (or
 * a usage refresh during provisioning) don't drop each other's keys.
 */
export async function patchServiceModuleState(serviceId: string, moduleId: string, patch: Record<string, unknown>) {
  await db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "services" WHERE "id" = ${serviceId} FOR UPDATE`;
    const row = await tx.service.findUnique({ where: { id: serviceId }, select: { moduleData: true } });
    const all = { ...asObject(row?.moduleData) };
    const next: Record<string, unknown> = { ...asObject(all[moduleId]) };
    for (const [key, value] of Object.entries(patch)) {
      if (value === undefined) delete next[key];
      else next[key] = value;
    }
    all[moduleId] = next;
    await tx.service.update({ where: { id: serviceId }, data: { moduleData: all as Prisma.InputJsonValue } });
  });
}

/** ServerModuleState over Service.moduleData (what the server bridge hands to modules). */
export function createServiceModuleState(serviceId: string, moduleId: string): ServerModuleState {
  return {
    get: () => readServiceModuleState(serviceId, moduleId),
    patch: (patch) => patchServiceModuleState(serviceId, moduleId, patch),
  };
}

/** Copy of a service row without moduleData (safe to serialise to the browser). */
export function omitModuleData<T extends { moduleData?: unknown }>(service: T): Omit<T, "moduleData"> {
  const { moduleData: _omit, ...rest } = service;
  void _omit;
  return rest;
}
