import { z } from "zod/v4";
import { db } from "@/lib/db";
import { ApiError } from "../errors";
import { defineOperation } from "../operation";
import { dateTimeSchema } from "../schemas";

const TAG = "Meta";

export const getMe = defineOperation({
  id: "getTokenInfo",
  method: "GET",
  path: "/me",
  tag: TAG,
  summary: "Token ve sahibinin bilgisi, etkin yetkiler",
  description:
    "`scopes` = token'a verilen ve sahibinin rolünün hâlâ tanıdığı yetkiler (her istekte yeniden hesaplanır). `grantedScopes` token'a kaydedilenlerdir; sahibi rol kaybettiyse fazlası etkisizdir.",
  permission: null,
  response: z.object({
    token: z.object({
      id: z.string(),
      name: z.string(),
      prefix: z.string(),
      expiresAt: dateTimeSchema.nullable(),
      rateLimitPerMinute: z.number().int(),
      ipAllowlist: z.array(z.string()),
    }),
    owner: z.object({ id: z.string(), name: z.string(), email: z.string(), role: z.string() }),
    scopes: z.array(z.string()),
    grantedScopes: z.array(z.string()),
  }),
  handler: async ({ context }) => {
    const token = await db.staffApiToken.findUnique({
      where: { id: context.token.id },
      select: { tokenPrefix: true, expiresAt: true, ipAllowlist: true, scopes: true },
    });
    if (!token) throw new ApiError(401, "invalid_token", "Token geçersiz");
    return {
      data: {
        token: {
          id: context.token.id,
          name: context.token.name,
          prefix: token.tokenPrefix,
          expiresAt: token.expiresAt?.toISOString() ?? null,
          rateLimitPerMinute: context.token.rateLimitPerMinute,
          ipAllowlist: token.ipAllowlist,
        },
        owner: context.owner,
        scopes: context.scopes,
        grantedScopes: token.scopes,
      },
    };
  },
});

export const getOpenApi = defineOperation({
  id: "getOpenApiDocument",
  method: "GET",
  path: "/openapi.json",
  tag: TAG,
  summary: "OpenAPI 3.1 belgesi",
  description: "Bu API'nin makine tarafından okunur tanımı (zarf olmadan, doğrudan belge döner).",
  permission: null,
  response: z.object({ openapi: z.string() }).passthrough(),
  handler: async ({ request }) => {
    const { buildAdminOpenApiDocument } = await import("../openapi");
    return { data: buildAdminOpenApiDocument(new URL(request.url).origin), raw: true };
  },
});
