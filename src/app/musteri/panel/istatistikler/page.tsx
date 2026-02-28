import { auth } from "@/lib/auth";
import { getServicesByCustomer } from "@/lib/dal/services";
import { IstatistiklerContent } from "./content";

export default async function IstatistiklerPage() {
  const session = await auth();
  const services = await getServicesByCustomer(session!.user.id);

  // Aggregate resource stats from real service data
  const totalBandwidth = services.reduce(
    (acc, s) => acc + Number(s.bandwidthUsed ?? 0),
    0
  );
  const totalDisk = services.reduce(
    (acc, s) => acc + Number(s.diskUsed ?? 0),
    0
  );
  const avgCpu =
    services.length > 0
      ? services.reduce((acc, s) => acc + Number(s.cpuUsage ?? 0), 0) /
        services.length
      : 0;

  const overviewStats = {
    totalBandwidth: Number(totalBandwidth.toFixed(1)),
    totalDisk: Number(totalDisk.toFixed(1)),
    avgCpu: Number(avgCpu.toFixed(0)),
  };

  // Serialize service resource data for per-service usage section
  const serviceUsage = services.map((s) => ({
    id: s.id,
    name: s.product.name,
    label: s.label,
    categorySlug: s.product.category?.slug ?? "hosting",
    disk: {
      used: Number(s.diskUsed ?? 0),
      total: Number(s.diskLimit ?? 0),
    },
    bandwidth: {
      used: Number(s.bandwidthUsed ?? 0),
      total: Number(s.bandwidthLimit ?? 0),
    },
    cpu: Number(s.cpuUsage ?? 0),
    ram: Number(s.ramUsage ?? 0),
    status: s.status,
  }));

  return (
    <IstatistiklerContent
      overviewStats={overviewStats}
      serviceUsage={serviceUsage}
      serviceCount={services.length}
    />
  );
}
