/**
 * Generic HTTP registrar provider — API contract
 *
 * Base URL: configured `registrar_api_url` (no trailing slash required)
 * Auth: `Authorization: Bearer <registrar_api_key>` when key is set
 * Method: POST for all endpoints
 * Content-Type: application/json
 *
 * Every request body includes `provider` (configured provider id) plus endpoint fields.
 *
 * --- POST /domains/register ---
 * Request:  { provider, domain, years, nameservers, customer? }
 * Response: { reference?: string, ok?: boolean }
 *
 * --- POST /domains/renew ---
 * Request:  { provider, domain, years }
 * Response: { reference?: string, ok?: boolean }
 *
 * --- POST /domains/nameservers ---
 * Request:  { provider, domain, nameservers: string[] }
 * Response: { reference?: string, ok?: boolean }
 *
 * --- POST /domains/dns ---
 * Request:  { provider, domain, records: Array<{ type, name, value, ttl?, priority? }> }
 * Response: { reference?: string, ok?: boolean }
 *
 * --- POST /domains/transfer ---
 * Request:  { provider, domain, eppCode, customer? }
 * Response: { reference?: string, ok?: boolean }
 *
 * --- POST /domains/availability ---
 * Request:  { provider, domain }
 * Response: { available: boolean, domain?: string, reference?: string }
 *
 * --- POST /health ---
 * Request:  { provider }
 * Response: { status: "ok" | string }
 *
 * Non-2xx responses are surfaced as IntegrationResult { ok: false, error: "HTTP_<status>" }.
 */

import { postIntegrationJson, type IntegrationResult } from "../../settings";
import type { RegistrarConfig } from "../types";
import type {
  DnsRecordInput,
  DomainAvailabilityData,
  NameserverInput,
  RegisterDomainInput,
  RenewDomainInput,
  TransferInput,
} from "../types";
import type { RegistrarProvider } from "./types";

type ReferencePayload = { reference?: string };
type AvailabilityPayload = { available?: boolean; domain?: string; reference?: string };
type HealthPayload = { status?: string };

export function createHttpRegistrarProvider(config: RegistrarConfig): RegistrarProvider {
  const provider = config.provider;

  async function post<T extends Record<string, unknown>>(
    path: string,
    body: unknown
  ): Promise<IntegrationResult<T>> {
    if (!config.apiUrl) {
      return {
        ok: false,
        skipped: true,
        provider,
        error: "REGISTRAR_NOT_CONFIGURED",
      };
    }

    const result = await postIntegrationJson<T>(config.apiUrl, path, config.apiKey ?? "", {
      provider,
      ...(body as Record<string, unknown>),
    });

    return {
      ...result,
      provider,
      reference:
        typeof result.data?.reference === "string" ? result.data.reference : undefined,
    };
  }

  return {
    name: provider,
    registerDomain: (input) => post<ReferencePayload>("/domains/register", input),
    renewDomain: (input) => post<ReferencePayload>("/domains/renew", input),
    updateNameservers: (input) => post<ReferencePayload>("/domains/nameservers", input),
    updateDnsRecords: (input) =>
      post<ReferencePayload>("/domains/dns", {
        domain: input.domain.name,
        records: input.records,
      }),
    transferDomain: (input) => post<ReferencePayload>("/domains/transfer", input),
    checkDomainAvailability: async (domain) => {
      const result = await post<AvailabilityPayload>("/domains/availability", { domain });

      if (!result.ok) {
        return result as IntegrationResult<DomainAvailabilityData>;
      }

      const available = Boolean(result.data?.available);
      const resolvedDomain =
        typeof result.data?.domain === "string" ? result.data.domain : domain;

      return {
        ...result,
        data: {
          domain: resolvedDomain,
          available,
        },
      };
    },
    healthCheck: async () => {
      const result = await post<HealthPayload>("/health", {});

      if (!result.ok) {
        return result as IntegrationResult<{ status: string }>;
      }

      return {
        ...result,
        data: {
          status: result.data?.status ?? "ok",
        },
      };
    },
  };
}