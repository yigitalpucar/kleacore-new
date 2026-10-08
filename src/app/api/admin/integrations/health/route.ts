import { checkIntegrationHealth } from "@/lib/integrations/health";
import { checkApiPermission } from "@/lib/utils/auth-helpers";
import { forbidden, success, unauthorized } from "@/lib/utils/api-response";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const access = await checkApiPermission("settings.manage");
  if (!access.ok) return access.status === 401 ? unauthorized() : forbidden();

  const health = await checkIntegrationHealth();
  return success(health);
}