import { getServices, getServiceStats } from "@/lib/dal/services";
import { parsePagination } from "@/lib/utils/pagination";
import { ServicesContent } from "../content";

export default async function AllServicesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const params = parsePagination(sp);

  const [result, stats] = await Promise.all([
    getServices(params),
    getServiceStats(),
  ]);

  return <ServicesContent data={result.data} stats={stats} />;
}
