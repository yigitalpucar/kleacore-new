import { db } from "@/lib/db";
import {
  getApiKeyPrefix,
  verifyApiKeyHash,
} from "@/lib/secrets/api-keys";

export interface ApiAuthContext {
  apiKeyId: string;
  customerId: string;
}

function extractApiKey(request: Request): string | null {
  const authorization = request.headers.get("authorization")?.trim();
  if (authorization?.toLowerCase().startsWith("bearer ")) {
    const token = authorization.slice(7).trim();
    if (token) return token;
  }

  const headerKey = request.headers.get("x-api-key")?.trim();
  return headerKey || null;
}

export async function authenticateApiRequest(
  request: Request
): Promise<ApiAuthContext | null> {
  const key = extractApiKey(request);
  if (!key) {
    return null;
  }

  const keyPrefix = getApiKeyPrefix(key);

  const candidates = await db.apiKey.findMany({
    where: {
      keyPrefix,
      isActive: true,
    },
    select: {
      id: true,
      userId: true,
      keyHash: true,
      expiresAt: true,
      user: { select: { status: true } },
    },
  });

  const apiKey = candidates.find((candidate) =>
    verifyApiKeyHash(key, candidate.keyHash)
  );

  if (!apiKey) {
    return null;
  }

  if (apiKey.expiresAt && apiKey.expiresAt < new Date()) {
    return null;
  }

  // Suspended/closed accounts must not keep API access through old keys.
  if (apiKey.user.status !== "ACTIVE") {
    return null;
  }

  await db.apiKey.update({
    where: { id: apiKey.id },
    data: { lastUsedAt: new Date() },
  });

  return {
    apiKeyId: apiKey.id,
    customerId: apiKey.userId,
  };
}