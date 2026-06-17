import { NextRequest } from "next/server";
import { authenticateApiRequest } from "@/lib/api/v1/auth";
import { enforceApiRateLimit } from "@/lib/api/v1/rate-limit";
import { serializeDomainDetail } from "@/lib/api/v1/serialize";
import { getDomainByIdOrName } from "@/lib/dal/domains";
import { forbidden, notFound, success, unauthorized } from "@/lib/utils/api-response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, context: RouteContext) {
  const auth = await authenticateApiRequest(request);
  if (!auth) {
    return unauthorized("Geçersiz veya eksik API anahtarı");
  }

  const rateLimited = await enforceApiRateLimit(auth.apiKeyId);
  if (rateLimited) {
    return rateLimited;
  }

  const { id: rawId } = await context.params;
  const identifier = decodeURIComponent(rawId);
  const domain = await getDomainByIdOrName(identifier);

  if (!domain) {
    return notFound("Domain bulunamadı");
  }

  if (domain.customerId !== auth.customerId) {
    return forbidden("Bu domaine erişim yetkiniz yok");
  }

  return success({
    domain: serializeDomainDetail(domain),
  });
}