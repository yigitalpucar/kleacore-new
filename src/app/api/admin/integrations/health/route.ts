import { checkIntegrationHealth } from "@/lib/integrations/health";
import { auth } from "@/lib/auth";
import { forbidden, success, unauthorized } from "@/lib/utils/api-response";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const session = await auth();
  const userRole = (session?.user as { role?: string } | undefined)?.role;

  if (!session?.user) return unauthorized();
  if (userRole !== "ADMIN") return forbidden();

  const health = await checkIntegrationHealth();
  return success(health);
}