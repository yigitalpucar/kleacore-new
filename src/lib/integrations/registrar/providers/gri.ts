import { db } from "@/lib/db";
import type { IntegrationResult } from "../../settings";
import type { GriRegistrarConfig, GriTldPricingRow } from "../types";
import type {
  DnsRecordInput,
  DomainAvailabilityData,
  DomainCustomer,
  NameserverInput,
  RegisterDomainInput,
  RegistrarDomainInfo,
  RenewDomainInput,
  TransferInput,
} from "../types";
import { GriApiError, GriClient, mapGriAvailability } from "./gri-client";
import type { RegistrarProvider } from "./types";

interface GriCheckItem {
  name: string;
  detail?: string;
}

interface GriCheckResponse {
  status?: boolean;
  data?: GriCheckItem[];
}

interface GriMutationResponse {
  status?: boolean;
  id?: string | number;
  message?: string;
}

const EXPIRY_KEYS = [
  "expiration_date",
  "expire_date",
  "expiry_date",
  "expires_at",
  "expired_at",
  "end_date",
  "expirationDate",
  "expireDate",
] as const;

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

/** Gri wraps payloads as `{ data: { attributes } }`, `{ data }` or flat; flatten them. */
function griPayload(raw: unknown): Record<string, unknown> {
  const root = asRecord(raw) ?? {};
  const data = asRecord(root.data);
  const attributes = asRecord(data?.attributes) ?? asRecord(root.attributes);
  return { ...root, ...(data ?? {}), ...(attributes ?? {}) };
}

function parseDate(value: unknown): Date | null {
  if (typeof value !== "string" && typeof value !== "number") return null;
  if (typeof value === "string" && !value.trim()) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) || date.getTime() <= 0 ? null : date;
}

function parseNameservers(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => {
      if (typeof entry === "string") return entry;
      const record = asRecord(entry);
      return typeof record?.name === "string" ? record.name : typeof record?.host === "string" ? record.host : "";
    })
    .map((name) => name.trim().toLowerCase().replace(/\.$/, ""))
    .filter(Boolean);
}

export function extractGriExpiry(raw: unknown): Date | null {
  const payload = griPayload(raw);
  for (const key of EXPIRY_KEYS) {
    const date = parseDate(payload[key]);
    if (date) return date;
  }
  return null;
}

/**
 * Maps a Gri domain detail response to RegistrarDomainInfo. Gri's B2B API
 * documents no stable schema for this endpoint, so field names are matched
 * defensively; anything missing is left undefined ("unknown"), never empty.
 */
export function parseGriDomainInfo(domain: string, raw: unknown): RegistrarDomainInfo {
  const payload = griPayload(raw);
  const statusValue = payload.status ?? payload.domain_status ?? payload.state;
  const status =
    typeof statusValue === "string" && statusValue.trim() ? statusValue.trim() : null;
  const nameservers = parseNameservers(payload.dns ?? payload.nameservers ?? payload.name_servers);

  return {
    domain,
    expiresAt: extractGriExpiry(raw),
    status,
    nameservers: nameservers.length ? nameservers : undefined,
  };
}

interface GriPricingAttributes {
  domain_tld?: string;
  register_amount?: number;
  renew_amount?: number;
  transfer_amount?: number;
  currency?: string;
}

interface GriPricingResponse {
  status?: boolean;
  data?: Array<{ attributes?: GriPricingAttributes }>;
  meta?: { max_page?: number };
}

function toGriContact(customer: DomainCustomer | null | undefined) {
  const firstname = customer?.name?.trim() || "Domain";
  const lastname = customer?.surname?.trim() || "Owner";

  return {
    firstname,
    lastname,
    organization: customer?.companyName?.trim() || "",
    email: customer?.email?.trim() || "admin@kleacore.com",
    phone: customer?.phone?.trim() || "+90.5550000000",
    address1: customer?.address?.trim() || "Istanbul",
    address2: "",
    city: customer?.city?.trim() || "Istanbul",
    state: "",
    country: customer?.country?.trim() || "TR",
    zip_code: "34000",
    fax: "",
    tax_number: "",
    tax_office: "",
    www: "",
  };
}

function toIntegrationError(error: unknown, provider = "gri"): IntegrationResult<never> {
  if (error instanceof GriApiError) {
    return { ok: false, provider, error: error.message };
  }
  return {
    ok: false,
    provider,
    error: error instanceof Error ? error.message : "GRI_REQUEST_FAILED",
  };
}

async function loadCustomer(customerId: string | undefined) {
  if (!customerId) return null;
  return db.user.findUnique({
    where: { id: customerId },
    select: {
      id: true,
      name: true,
      surname: true,
      email: true,
      phone: true,
      address: true,
      city: true,
      country: true,
      companyName: true,
    },
  });
}

export function createGriRegistrarProvider(config: GriRegistrarConfig): RegistrarProvider {
  const provider = "gri";
  const client = new GriClient(config);

  async function checkDomains(domains: string[]) {
    const unique = Array.from(new Set(domains.map((d) => d.trim().toLowerCase()).filter(Boolean)));
    if (unique.length === 0) {
      return { ok: true, provider, data: [] as DomainAvailabilityData[] };
    }

    try {
      const response = await client.request<GriCheckResponse>("/api/v2/domains/check", {
        method: "POST",
        body: { domains: unique },
      });

      const rows = response.data ?? [];
      const byDomain = new Map(
        rows.map((item) => [
          item.name.toLowerCase(),
          {
            domain: item.name.toLowerCase(),
            available: mapGriAvailability(item.detail),
          },
        ])
      );

      const data = unique.map(
        (domain) =>
          byDomain.get(domain) ?? {
            domain,
            available: false,
          }
      );

      return { ok: true, provider, data };
    } catch (error) {
      return toIntegrationError(error, provider);
    }
  }

  return {
    name: provider,

    checkDomainAvailability: async (domain) => {
      const result = await checkDomains([domain]);
      if (!result.ok || !result.data) {
        return result as IntegrationResult<DomainAvailabilityData>;
      }
      return {
        ok: true,
        provider,
        data: result.data[0] ?? { domain, available: false },
      };
    },

    checkDomainsAvailability: (domains) => checkDomains(domains),

    registerDomain: async (input) => {
      try {
        const customer = input.customer?.id
          ? (await loadCustomer(input.customer.id)) ?? input.customer
          : input.customer;

        const response = await client.request<GriMutationResponse>("/api/v2/domains/register", {
          method: "POST",
          body: {
            domain: input.domain.toLowerCase(),
            duration: Math.max(1, input.years),
            contact: toGriContact(customer),
            dns: input.nameservers.map((name) => ({ name, ip: "" })),
          },
        });

        return {
          ok: true,
          provider,
          reference: response.id ? String(response.id) : input.domain,
        };
      } catch (error) {
        return toIntegrationError(error, provider);
      }
    },

    renewDomain: async (input) => {
      try {
        const response = await client.request<GriMutationResponse>(
          `/api/v2/domain/${encodeURIComponent(input.domain.toLowerCase())}/renew`,
          {
            method: "GET",
            query: { duration: Math.max(1, input.years) },
          }
        );

        const ok = Boolean(response.status ?? true);
        return {
          ok,
          provider,
          reference: input.domain,
          data: { expiresAt: extractGriExpiry(response) },
          error: ok ? undefined : response.message || "GRI_RENEW_REJECTED",
        };
      } catch (error) {
        return toIntegrationError(error, provider);
      }
    },

    getDomainInfo: async (domain) => {
      const name = domain.trim().toLowerCase();
      try {
        const response = await client.request<unknown>(`/api/v2/domain/${encodeURIComponent(name)}`, {
          method: "GET",
        });
        return { ok: true, provider, data: parseGriDomainInfo(name, response) };
      } catch (error) {
        return toIntegrationError(error, provider);
      }
    },

    updateNameservers: async (input: NameserverInput) => {
      try {
        const response = await client.request<GriMutationResponse>(
          `/api/v2/domain/${encodeURIComponent(input.domain.toLowerCase())}/change-dns`,
          {
            method: "POST",
            body: {
              dns: input.nameservers.map((name) => ({ name, ip: "" })),
            },
          }
        );

        return {
          ok: Boolean(response.status ?? true),
          provider,
          reference: input.domain,
        };
      } catch (error) {
        return toIntegrationError(error, provider);
      }
    },

    updateDnsRecords: async (input: DnsRecordInput) => {
      try {
        const domainName = input.domain.name.toLowerCase();
        const dns = input.records.map((record) => {
          const host =
            record.name === "@" || record.name === domainName
              ? domainName
              : record.name.endsWith(`.${domainName}`)
                ? record.name.slice(0, -(domainName.length + 1))
                : record.name;

          return {
            name: host,
            ip: record.value,
          };
        });

        const response = await client.request<GriMutationResponse>(
          `/api/v2/domain/${encodeURIComponent(domainName)}/change-sub-dns`,
          {
            method: "POST",
            body: { dns },
          }
        );

        return {
          ok: Boolean(response.status ?? true),
          provider,
          reference: domainName,
        };
      } catch (error) {
        return toIntegrationError(error, provider);
      }
    },

    transferDomain: async (input: TransferInput) => {
      try {
        const response = await client.request<GriMutationResponse>(
          "/api/v2/domain-transfer/demand",
          {
            method: "POST",
            body: {
              domain: input.domain.toLowerCase(),
              auth_code: input.eppCode,
            },
          }
        );

        return {
          ok: Boolean(response.status ?? true),
          provider,
          reference: response.id ? String(response.id) : input.domain,
        };
      } catch (error) {
        return toIntegrationError(error, provider);
      }
    },

    healthCheck: async () => {
      try {
        await client.testConnection();
        return { ok: true, provider, data: { status: "ok" } };
      } catch (error) {
        const result = toIntegrationError(error, provider);
        return {
          ...result,
          data: { status: "error" },
        };
      }
    },

    fetchTldPricing: async () => fetchGriTldPricing(client),
  };
}

export async function fetchGriTldPricing(client: GriClient): Promise<
  IntegrationResult<GriTldPricingRow[]>
> {
  const provider = "gri";
  const rows: GriTldPricingRow[] = [];

  try {
    let page = 0;
    let maxPage = 0;

    do {
      const response = await client.request<GriPricingResponse>("/api/v2/pricing", {
        method: "GET",
        query: { page },
      });

      maxPage = response.meta?.max_page ?? 0;

      for (const item of response.data ?? []) {
        const attrs = item.attributes;
        if (!attrs?.domain_tld) continue;

        const ext = attrs.domain_tld.startsWith(".")
          ? attrs.domain_tld
          : `.${attrs.domain_tld}`;

        rows.push({
          tld: ext.toLowerCase(),
          register: Number(attrs.register_amount ?? 0),
          renew: Number(attrs.renew_amount ?? 0),
          transfer: Number(attrs.transfer_amount ?? 0),
          currency: attrs.currency ?? "TRY",
        });
      }

      page += 1;
    } while (page <= maxPage);

    return { ok: true, provider, data: rows };
  } catch (error) {
    return toIntegrationError(error, provider);
  }
}