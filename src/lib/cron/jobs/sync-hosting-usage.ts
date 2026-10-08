import { enqueueHostingUsageSync } from "@/lib/services/usage-sync";

/**
 * Daily: queue one `hosting.usage-sync` job per server module instance that
 * reads usage in bulk (cPanel/WHM). The jobs do the panel calls, so this
 * run is quick and a slow panel never holds the cron lock.
 */
export async function syncHostingUsageJob() {
  return enqueueHostingUsageSync();
}
