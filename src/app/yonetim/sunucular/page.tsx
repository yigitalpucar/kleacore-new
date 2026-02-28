import { getServers } from "@/lib/dal/servers";
import { SunucularContent } from "./content";

export default async function SunucularPage() {
  const servers = await getServers();

  return <SunucularContent servers={servers} />;
}
