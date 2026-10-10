import type { IntegrationResult } from "@/lib/integrations/settings";
import type { DomainAvailabilityData } from "@/lib/integrations/registrar/types";

/**
 * Domain availability for the public search, with an honest four-way answer:
 *
 * - `available`  — the registrar said it can be registered;
 * - `registered` — in our own database, the registrar said taken, or RDAP
 *                  returned a registration;
 * - `likely`     — no registrar answer, but the registry's RDAP server has no
 *                  record (a 404 from the registry itself);
 * - `unknown`    — nothing could be checked (registrar off/unreachable and no
 *                  RDAP service for the TLD, e.g. .tr, or a timeout).
 *
 * Every answer is cached in memory (registrar/RDAP calls are slow and rate
 * limited upstream), so search-as-you-type and repeated searches cost at most
 * one upstream check per domain per TTL on each app instance.
 */
export type AvailabilityStatus = "available" | "likely" | "registered" | "unknown";

export type RdapAnswer = "registered" | "not_found" | "no_service" | "error";

export interface AvailabilityRegistrar {
  checkDomainsAvailability?(domains: string[]): Promise<IntegrationResult<DomainAvailabilityData[]>>;
  checkDomainAvailability(domain: string): Promise<IntegrationResult<DomainAvailabilityData>>;
}

export interface AvailabilityDeps {
  /** Domains (of the list) that exist in our own database. */
  findLocal(domains: string[]): Promise<string[]>;
  registrar(): Promise<AvailabilityRegistrar>;
  rdap(domain: string): Promise<RdapAnswer>;
  now?: () => number;
}

const TTL_MS: Record<AvailabilityStatus, number> = {
  available: 5 * 60 * 1000,
  registered: 30 * 60 * 1000,
  likely: 5 * 60 * 1000,
  unknown: 60 * 1000,
};
const MAX_CACHE_ENTRIES = 5000;
const UPSTREAM_CONCURRENCY = 4;

async function mapLimit<T, R>(values: T[], limit: number, fn: (value: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(values.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, values.length) }, async () => {
    while (next < values.length) {
      const index = next++;
      results[index] = await fn(values[index]);
    }
  });
  await Promise.all(workers);
  return results;
}

function fromRdap(answer: RdapAnswer): AvailabilityStatus {
  if (answer === "registered") return "registered";
  if (answer === "not_found") return "likely";
  return "unknown";
}

export function createAvailabilityChecker(deps: AvailabilityDeps) {
  const cache = new Map<string, { status: AvailabilityStatus; expiresAt: number }>();
  const now = deps.now ?? Date.now;

  function remember(domain: string, status: AvailabilityStatus) {
    if (cache.size >= MAX_CACHE_ENTRIES) {
      // Drop the oldest insertion (Map keeps insertion order).
      const oldest = cache.keys().next().value;
      if (oldest !== undefined) cache.delete(oldest);
    }
    cache.set(domain, { status, expiresAt: now() + TTL_MS[status] });
  }

  async function lookupUpstream(domains: string[]): Promise<Map<string, AvailabilityStatus>> {
    const statuses = new Map<string, AvailabilityStatus>();
    if (domains.length === 0) return statuses;

    const registrar = await deps.registrar();
    if (registrar.checkDomainsAvailability) {
      const batch = await registrar.checkDomainsAvailability(domains).catch(() => null);
      if (batch?.ok && !batch.skipped && batch.data) {
        for (const item of batch.data) {
          statuses.set(item.domain.toLowerCase(), item.available ? "available" : "registered");
        }
      }
    }

    const rest = domains.filter((domain) => !statuses.has(domain));
    const answers = await mapLimit(rest, UPSTREAM_CONCURRENCY, async (domain) => {
      const single = await registrar.checkDomainAvailability(domain).catch(() => null);
      if (single?.ok && !single.skipped && single.data) {
        return single.data.available ? "available" : "registered";
      }
      return fromRdap(await deps.rdap(domain).catch(() => "error" as const));
    });
    rest.forEach((domain, index) => statuses.set(domain, answers[index]));
    return statuses;
  }

  return {
    async check(domains: string[]): Promise<Map<string, AvailabilityStatus>> {
      const unique = Array.from(new Set(domains.map((domain) => domain.toLowerCase())));
      const result = new Map<string, AvailabilityStatus>();
      const missing: string[] = [];
      for (const domain of unique) {
        const hit = cache.get(domain);
        if (hit && hit.expiresAt > now()) result.set(domain, hit.status);
        else missing.push(domain);
      }
      if (missing.length === 0) return result;

      const local = new Set((await deps.findLocal(missing)).map((domain) => domain.toLowerCase()));
      for (const domain of local) {
        result.set(domain, "registered");
        remember(domain, "registered");
      }
      const upstream = await lookupUpstream(missing.filter((domain) => !local.has(domain)));
      for (const [domain, status] of upstream) {
        result.set(domain, status);
        remember(domain, status);
      }
      return result;
    },
    /** For tests. */
    clear() {
      cache.clear();
    },
  };
}

const RDAP_TIMEOUT_MS = 3500;

/**
 * rdap.org answers 404 both for "no such domain" (from the registry after a
 * redirect) and for TLDs without an RDAP service (.tr): only the first one
 * says anything about availability.
 */
export async function fetchRdapAnswer(domain: string): Promise<RdapAnswer> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), RDAP_TIMEOUT_MS);
  try {
    const response = await fetch(`https://rdap.org/domain/${encodeURIComponent(domain)}`, {
      headers: {
        accept: "application/rdap+json, application/json",
        "user-agent": "KLEACORE/1.0 (+https://kleacore.com)",
      },
      signal: controller.signal,
    });
    if (response.status === 404) {
      const body = (await response.json().catch(() => null)) as { title?: string } | null;
      return /no rdap service/i.test(body?.title ?? "") ? "no_service" : "not_found";
    }
    if (!response.ok) return "error";
    const data = (await response.json()) as { objectClassName?: string; ldhName?: string };
    return data.objectClassName === "domain" || data.ldhName ? "registered" : "error";
  } catch {
    return "error";
  } finally {
    clearTimeout(timeout);
  }
}
