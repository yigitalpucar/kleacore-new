import { db } from "@/lib/db";
import type { ProvisioningJobStatus } from "@prisma/client";
import { serializeMoney } from "@/lib/money";

const defaultStatuses: ProvisioningJobStatus[] = ["FAILED", "PENDING", "PROCESSING"];

/** Admin list rows; order/product amounts are plain numbers (passed to a client component). */
export async function getProvisioningJobsForAdmin(statuses = defaultStatuses) {
  const jobs = await db.provisioningJob.findMany({
    // MANUAL tasks have their own screen (/yonetim/kurulumlar); "Yeniden dene" doesn't apply.
    where: {
      status: { in: statuses },
      kind: { not: "MANUAL" },
    },
    include: {
      order: {
        include: {
          product: {
            include: {
              category: true,
            },
          },
          customer: {
            select: {
              id: true,
              name: true,
              surname: true,
              companyName: true,
              email: true,
            },
          },
        },
      },
      service: {
        select: {
          id: true,
          label: true,
          domain: true,
          status: true,
        },
      },
    },
    orderBy: [{ updatedAt: "desc" }],
    take: 100,
  });
  return serializeMoney(jobs);
}

export async function getProvisioningJobStats() {
  const [failed, pending, processing, completed] = await Promise.all([
    db.provisioningJob.count({ where: { status: "FAILED", kind: { not: "MANUAL" } } }),
    db.provisioningJob.count({ where: { status: "PENDING", kind: { not: "MANUAL" } } }),
    db.provisioningJob.count({ where: { status: "PROCESSING", kind: { not: "MANUAL" } } }),
    db.provisioningJob.count({ where: { status: "COMPLETED", kind: { not: "MANUAL" } } }),
  ]);

  return {
    failed,
    pending,
    processing,
    completed,
    active: failed + pending + processing,
  };
}