import {
  getProvisioningJobStats,
  getProvisioningJobsForAdmin,
} from "@/lib/dal/provisioning-jobs";
import type { ProvisioningJobStatus } from "@prisma/client";
import { ProvisioningContent } from "./content";

export const dynamic = "force-dynamic";

function readStatusFilter(
  searchParams: Record<string, string | string[] | undefined>
): ProvisioningJobStatus[] | "all" {
  const value = searchParams.status;
  const status = typeof value === "string" ? value : undefined;

  if (!status || status === "all") {
    return "all";
  }

  const allowed: ProvisioningJobStatus[] = ["FAILED", "PENDING", "PROCESSING", "COMPLETED"];
  if (allowed.includes(status as ProvisioningJobStatus)) {
    return [status as ProvisioningJobStatus];
  }

  return "all";
}

export default async function ProvisioningPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const statusFilter = readStatusFilter(sp);

  const [jobs, stats] = await Promise.all([
    getProvisioningJobsForAdmin(
      statusFilter === "all" ? ["FAILED", "PENDING", "PROCESSING"] : statusFilter
    ),
    getProvisioningJobStats(),
  ]);

  return (
    <ProvisioningContent
      jobs={jobs}
      stats={stats}
      statusFilter={typeof sp.status === "string" ? sp.status : "active"}
    />
  );
}