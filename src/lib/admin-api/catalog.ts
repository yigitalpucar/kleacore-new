/** Scope → endpoints table for the token form and the docs page. */
import { PERMISSIONS, type Permission } from "@/lib/auth/permissions";
import { ADMIN_API_OPERATIONS } from "./registry";
import { scopeLabel } from "./scopes";

export interface ScopeCatalogEntry {
  permission: Permission;
  label: string;
  operations: Array<{ id: string; method: string; path: string; summary: string }>;
}

/** Permissions that some endpoint requires, in PERMISSIONS order. */
export function adminApiScopeCatalog(): ScopeCatalogEntry[] {
  return PERMISSIONS.flatMap((permission) => {
    const operations = ADMIN_API_OPERATIONS.filter((operation) => operation.permission === permission).map((operation) => ({
      id: operation.id,
      method: operation.method,
      path: operation.path,
      summary: operation.summary,
    }));
    return operations.length > 0 ? [{ permission, label: scopeLabel(permission), operations }] : [];
  });
}
