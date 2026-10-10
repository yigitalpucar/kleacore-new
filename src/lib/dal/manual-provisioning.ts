import type { ProvisioningJobStatus } from "@prisma/client";
import { db } from "@/lib/db";

const taskInclude = {
  order: {
    select: {
      id: true,
      orderNumber: true,
      domain: true,
      billingPeriod: true,
      createdAt: true,
      completedAt: true,
      customerNotes: true,
      items: { select: { configuration: true }, take: 1 },
      invoice: { select: { id: true, invoiceNumber: true, paidAt: true } },
      product: { select: { id: true, name: true, category: { select: { slug: true, name: true } } } },
      customer: {
        select: { id: true, name: true, surname: true, companyName: true, email: true, phone: true },
      },
    },
  },
  service: { select: { id: true, label: true, domain: true, status: true, ipAddress: true, serverName: true, username: true } },
} as const;

/** Manual provisioning tasks (/yonetim/kurulumlar). Pending first, oldest first (SLA order). */
export async function getManualProvisioningTasks(statuses: ProvisioningJobStatus[]) {
  return db.provisioningJob.findMany({
    where: { kind: "MANUAL", status: { in: statuses } },
    include: taskInclude,
    orderBy: [{ createdAt: statuses.includes("COMPLETED") && statuses.length === 1 ? "desc" : "asc" }],
    take: 200,
  });
}

export async function getManualProvisioningTask(id: string) {
  return db.provisioningJob.findFirst({ where: { id, kind: "MANUAL" }, include: taskInclude });
}

export async function getManualProvisioningCounts() {
  const [pending, completed] = await Promise.all([
    db.provisioningJob.count({ where: { kind: "MANUAL", status: { in: ["PENDING", "PROCESSING", "FAILED"] } } }),
    db.provisioningJob.count({ where: { kind: "MANUAL", status: "COMPLETED" } }),
  ]);
  return { pending, completed };
}
