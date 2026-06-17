import { db } from "@/lib/db";
import type { IntegrationResult } from "../../settings";
import type { GriRegistrarConfig, GriTldPricingRow } from "../types";
import type {
  DnsRecordInput,
  DomainAvailabilityData,
  DomainCustomer,
  NameserverInput,
  RegisterDomainInput,
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

        return {
          ok: Boolean(response.status ?? true),
          provider,
          reference: input.domain,
        };
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