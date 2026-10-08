/**
 * Product.moduleOptions validation (pure; no registry import so module
 * files and the server bridge can use it without import cycles).
 */
import type { AnyModuleManifest } from "./types";

/**
 * Validates Product.moduleOptions against the manifest's
 * productOptionsSchema (modules without one accept `{}` only as-is).
 */
export function parseProductOptions(
  manifest: AnyModuleManifest,
  raw: unknown
): { success: true; data: Record<string, unknown> } | { success: false; error: string; fieldErrors: Record<string, string> } {
  const input = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
  if (!manifest.productOptionsSchema) return { success: true, data: input as Record<string, unknown> };

  const parsed = manifest.productOptionsSchema.safeParse(input);
  if (parsed.success) return { success: true, data: parsed.data as Record<string, unknown> };

  const fieldErrors: Record<string, string> = {};
  for (const issue of parsed.error.issues) {
    const key = String(issue.path[0] ?? "_");
    fieldErrors[key] ??= issue.message;
  }
  return {
    success: false,
    error: `MODULE_OPTIONS_INVALID: ${manifest.id} (${Object.keys(fieldErrors).join(", ")})`,
    fieldErrors,
  };
}
