import { getServers } from "@/lib/dal/servers";
import { SunucularContent } from "./content";

export const dynamic = "force-dynamic";

export default async function SunucularPage() {
  const servers = await getServers();

  return <SunucularContent servers={servers} />;
}
