import type { IntegrationResult } from "./settings";

export function disabledResult<T>(provider: string, error: string): IntegrationResult<T> {
  return {
    ok: false,
    skipped: true,
    provider,
    error,
  };
}