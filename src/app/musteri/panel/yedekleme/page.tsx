import { auth } from "@/lib/auth";
import { getBackupsByCustomer, getSchedulesByCustomer } from "@/lib/dal/backups";
import { YedeklemeContent } from "./content";

export default async function YedeklemePage() {
  const session = await auth();
  const userId = session!.user.id;

  const [backups, schedules] = await Promise.all([
    getBackupsByCustomer(userId),
    getSchedulesByCustomer(userId),
  ]);

  const serializedBackups = backups.map((b) => ({
    id: b.id,
    serviceName: b.service.label || b.service.domain || "Bilinmeyen",
    serviceType: b.service.product?.category?.slug ?? "hosting",
    type: b.type,
    status: b.status,
    size: Number(b.size ?? 0),
    filePath: b.filePath,
    startedAt: b.startedAt ? b.startedAt.toISOString() : null,
    completedAt: b.completedAt ? b.completedAt.toISOString() : null,
    createdAt: b.createdAt.toISOString(),
    scheduleId: b.scheduleId,
  }));

  const serializedSchedules = schedules.map((s) => {
    const svc = s.service as { id: string; label: string; product: { category: { slug: string } | null } | null } | undefined;
    return {
      id: s.id,
      serviceId: s.serviceId,
      serviceName: svc?.label || "Bilinmeyen",
      serviceType: svc?.product?.category?.slug ?? "hosting",
      frequency: s.frequency,
      retention: s.retention,
      isActive: s.isActive,
      lastRunAt: s.lastRunAt ? s.lastRunAt.toISOString() : null,
      nextRunAt: s.nextRunAt ? s.nextRunAt.toISOString() : null,
      backupCount: s._count.backups,
    };
  });

  const stats = {
    total: backups.length,
    totalSize: Number(
      backups.reduce((acc, b) => acc + Number(b.size ?? 0), 0).toFixed(1)
    ),
    completed: backups.filter((b) => b.status === "COMPLETED").length,
    failed: backups.filter((b) => b.status === "FAILED").length,
    inProgress: backups.filter((b) => b.status === "IN_PROGRESS").length,
    lastBackupAt: backups.length > 0 ? backups[0].createdAt.toISOString() : null,
  };

  return (
    <YedeklemeContent
      backups={serializedBackups}
      schedules={serializedSchedules}
      stats={stats}
    />
  );
}
