import type { Metadata } from "next";
import { adminApiScopeCatalog } from "@/lib/admin-api/catalog";
import { listStaffApiTokens, tokenState } from "@/lib/admin-api/tokens";
import { scopeLabel } from "@/lib/admin-api/scopes";
import { permissionsForRole } from "@/lib/auth/permissions";
import { requirePermission } from "@/lib/utils/auth-helpers";
import { ApiTokensContent, type ApiTokenRow } from "./content";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "API token'ları" };

export default async function ApiTokensPage() {
  const session = await requirePermission("api_tokens.manage");
  const granted = permissionsForRole(session.user.role);
  const tokens = await listStaffApiTokens({ userId: session.user.id });

  const rows: ApiTokenRow[] = tokens.map((token) => ({
    id: token.id,
    name: token.name,
    prefix: token.tokenPrefix,
    scopes: token.scopes.map((scope) => ({ value: scope, label: scopeLabel(scope), effective: (granted as readonly string[]).includes(scope) })),
    ipAllowlist: token.ipAllowlist,
    rateLimitPerMinute: token.rateLimitPerMinute,
    expiresAt: token.expiresAt?.toISOString() ?? null,
    lastUsedAt: token.lastUsedAt?.toISOString() ?? null,
    lastUsedIp: token.lastUsedIp,
    createdAt: token.createdAt.toISOString(),
    state: tokenState(token),
  }));

  const scopeOptions = adminApiScopeCatalog()
    .filter((entry) => granted.includes(entry.permission))
    .map((entry) => ({
      value: entry.permission,
      label: entry.label,
      endpoints: entry.operations.map((operation) => `${operation.method} ${operation.path}`),
    }));

  return <ApiTokensContent tokens={rows} scopeOptions={scopeOptions} />;
}
