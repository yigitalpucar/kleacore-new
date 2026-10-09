import { db } from "@/lib/db";
import {
  type PaginationParams,
  paginationMeta,
} from "@/lib/utils/pagination";
import type { BackupStatus, BackupType } from "@prisma/client";

interface GetBackupsParams extends PaginationParams {
  status?: BackupStatus;
  type?: BackupType;
  serviceId?: string;
  customerId?: string;
}

export async function getBackups(params: GetBackupsParams) {
  const {
    page,
    perPage,
    search,
    sortBy,
    sortOrder,
    status,
    type,
    serviceId,
    customerId,
  } = params;

  const where = {
    ...(status && { status }),
    ...(type && { type }),
    ...(serviceId && { serviceId }),
    ...(customerId && { customerId }),
    ...(search && {
      service: {
        OR: [
          { label: { contains: search, mode: "insensitive" as const } },
          { domain: { contains: search, mode: "insensitive" as const } },
        ],
      },
    }),
  };

  const [data, total] = await Promise.all([
    db.backup.findMany({
      where,
      include: {
        service: {
          select: {
            id: true,
            label: true,
            domain: true,
            product: {
              select: { id: true, name: true },
            },
          },
        },
        customer: {
          select: {
            id: true,
            name: true,
            surname: true,
            email: true,
          },
        },
        schedule: true,
      },
      orderBy: { [sortBy || "createdAt"]: sortOrder || "desc" },
      skip: (page - 1) * perPage,
      take: perPage,
    }),
    db.backup.count({ where }),
  ]);

  return { data, ...paginationMeta(total, params) };
}

export async function getSchedules(serviceId: string) {
  return db.backupSchedule.findMany({
    where: { serviceId },
    include: {
      _count: {
        select: { backups: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function getBackupsByCustomer(customerId: string) {
  return db.backup.findMany({
    // Deleted archives and final (termination) backups are not the customer's to manage.
    where: { customerId, deletedAt: null, trigger: { not: "FINAL" } },
    include: {
      service: {
        select: {
          id: true,
          label: true,
          domain: true,
          product: {
            select: { category: { select: { slug: true } } },
          },
        },
      },
      schedule: true,
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function getSchedulesByCustomer(customerId: string) {
  // BackupSchedule has no direct Service relation.
  // Find schedules linked to this customer's services via serviceId.
  const customerServices = await db.service.findMany({
    where: { customerId },
    select: { id: true, label: true, product: { select: { category: { select: { slug: true } } } } },
  });

  const serviceIds = customerServices.map((s) => s.id);
  if (serviceIds.length === 0) return [];

  const schedules = await db.backupSchedule.findMany({
    where: { serviceId: { in: serviceIds } },
    include: {
      _count: { select: { backups: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  // Merge service info onto each schedule
  const serviceMap = new Map(customerServices.map((s) => [s.id, s]));

  return schedules.map((s) => ({
    ...s,
    service: serviceMap.get(s.serviceId) ?? { id: s.serviceId, label: "", product: null },
  }));
}
