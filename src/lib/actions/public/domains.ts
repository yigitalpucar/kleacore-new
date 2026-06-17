"use server";

import { z } from "zod";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { checkRateLimit, normalizeRateLimitKey } from "@/lib/rate-limit";
const DOMAIN_SEARCH_EXTENSIONS = [
  ".com",
  ".net",
  ".org",
  ".com.tr",
  ".io",
  ".co",
  ".dev",
  ".app",
] as const;
import { checkDomainsAvailability, getRegistrarProvider } from "@/lib/integrations/registrar";
import {
  getRegistrarConfig,
  isGriRegistrarEnabled,
} from "@/lib/integrations/registrar/config";
import {
  createManualDomainTransferTicket,
  processAutomatedDomainTransfer,
} from "@/lib/actions/customer/domain-transfer";
import type { DomainStatus } from "@prisma/client";

const DOMAIN_LABEL_REGEX = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;
const FULL_DOMAIN_REGEX =
  /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/;
const RDAP_TIMEOUT_MS = 3500;

function normalizeDomainInput(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .split(/[/?#]/)[0]
    .replace(/\s+/g, "");
}

function normalizeExtension(ext: string): string | null {
  const normalized = ext.trim().toLowerCase();
  if (!normalized) return null;
  const withDot = normalized.startsWith(".") ? normalized : `.${normalized}`;
  if (!/^(\.[a-z0-9-]+)+$/.test(withDot)) return null;
  return withDot;
}

function extractDomainLabel(query: string): string | null {
  const normalized = normalizeDomainInput(query);
  if (!normalized) return null;
  const base = normalized.includes(".") ? normalized.split(".")[0] : normalized;
  if (!DOMAIN_LABEL_REGEX.test(base)) return null;
  return base;
}

function normalizeFullDomain(query: string): string | null {
  const normalized = normalizeDomainInput(query);
  if (!normalized) return null;
  const full = normalized.includes(".") ? normalized : `${normalized}.com`;
  if (!FULL_DOMAIN_REGEX.test(full)) return null;
  return full;
}

function parseNameservers(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === "string");
  }

  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) {
        return parsed.filter((item): item is string => typeof item === "string");
      }
    } catch {
      // ignore malformed legacy values
    }
  }

  return [];
}

function mapWhoisStatus(status: DomainStatus): string[] {
  switch (status) {
    case "ACTIVE":
      return ["ok", "clientTransferProhibited"];
    case "EXPIRED":
      return ["expired", "redemptionPeriod"];
    case "TRANSFERRING":
      return ["pendingTransfer"];
    case "PENDING":
      return ["pendingCreate"];
    default:
      return ["unknown"];
  }
}

interface RdapEvent {
  eventAction?: string;
  eventDate?: string;
}

interface RdapNameserver {
  ldhName?: string;
  unicodeName?: string;
}

interface RdapEntity {
  roles?: string[];
  vcardArray?: unknown;
}

interface RdapDomainResponse {
  objectClassName?: string;
  ldhName?: string;
  unicodeName?: string;
  status?: string[];
  events?: RdapEvent[];
  nameservers?: RdapNameserver[];
  entities?: RdapEntity[];
  secureDNS?: {
    delegationSigned?: boolean;
  };
}

async function fetchRdapDomain(domain: string): Promise<RdapDomainResponse | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), RDAP_TIMEOUT_MS);

  try {
    const response = await fetch(`https://rdap.org/domain/${encodeURIComponent(domain)}`, {
      headers: { accept: "application/rdap+json, application/json" },
      next: { revalidate: 300 },
      signal: controller.signal,
    });

    if (response.status === 404) return null;
    if (!response.ok) throw new Error(`RDAP_${response.status}`);

    return (await response.json()) as RdapDomainResponse;
  } finally {
    clearTimeout(timeout);
  }
}

async function isRegisteredViaRdap(domain: string) {
  try {
    const rdap = await fetchRdapDomain(domain);
    return rdap?.objectClassName === "domain" || Boolean(rdap?.ldhName || rdap?.unicodeName);
  } catch {
    return false;
  }
}

async function isDomainRegistered(
  domain: string,
  registrarProvider: Awaited<ReturnType<typeof getRegistrarProvider>>
) {
  const availability = await registrarProvider.checkDomainAvailability(domain);

  if (!availability.skipped && availability.ok && availability.data) {
    return !availability.data.available;
  }

  return isRegisteredViaRdap(domain);
}

function getRdapEventDate(rdap: RdapDomainResponse, actions: string[]) {
  const normalizedActions = actions.map((action) => action.toLowerCase());
  return (
    rdap.events?.find((event) =>
      normalizedActions.includes((event.eventAction ?? "").toLowerCase())
    )?.eventDate ?? ""
  );
}

function getVcardValue(entity: RdapEntity, fieldName: string): string | null {
  const vcardArray = entity.vcardArray;
  if (!Array.isArray(vcardArray) || !Array.isArray(vcardArray[1])) return null;

  const entry = vcardArray[1].find(
    (item): item is unknown[] => Array.isArray(item) && item[0] === fieldName
  );

  const value = entry?.[3];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function getRdapRegistrar(rdap: RdapDomainResponse) {
  const registrar = rdap.entities?.find((entity) => entity.roles?.includes("registrar"));
  if (!registrar) return "Bilinmiyor";

  return getVcardValue(registrar, "fn") ?? getVcardValue(registrar, "org") ?? "Bilinmiyor";
}

export interface DomainAvailabilityResult {
  domain: string;
  available: boolean;
  price: number;
  renewPrice: number;
  transfer: number;
}

export async function searchDomainAvailability(
  query: string,
  extensions?: readonly string[]
) {
  const limit = await checkRateLimit({
    key: `domain-search:${normalizeRateLimitKey(query)}`,
    limit: 30,
    windowMs: 10 * 60 * 1000,
  });
  if (!limit.allowed) {
    return { success: false, error: "Çok fazla domain sorgusu yapıldı. Lütfen biraz sonra tekrar deneyin." as const };
  }

  const label = extractDomainLabel(query);
  if (!label) {
    return { success: false, error: "Geçerli bir domain adı girin" as const };
  }

  const requestedExtensions =
    extensions && extensions.length > 0 ? extensions : DOMAIN_SEARCH_EXTENSIONS;

  const normalizedExtensions = Array.from(
    new Set(
      requestedExtensions
        .map((ext) => normalizeExtension(ext))
        .filter((ext): ext is string => ext !== null)
    )
  ).slice(0, 20);

  if (normalizedExtensions.length === 0) {
    return { success: false, error: "Geçerli uzantı bulunamadı" as const };
  }

  const domainsToCheck = normalizedExtensions.map((ext) => `${label}${ext}`);

  const [existing, tldRecords] = await Promise.all([
    db.domain.findMany({
      where: { name: { in: domainsToCheck } },
      select: { name: true },
    }),
    db.domainTld.findMany({
      where: { ext: { in: [...normalizedExtensions] } },
    }),
  ]);

  const registeredDomains = new Set(
    existing.map((item) => item.name.toLowerCase())
  );
  const tldMap = new Map(tldRecords.map((t) => [t.ext, t]));

  const externallyRegisteredDomains = new Set<string>();

  for (const domain of domainsToCheck) {
    if (registeredDomains.has(domain)) {
      externallyRegisteredDomains.add(domain);
    }
  }

  const uncheckedDomains = domainsToCheck.filter((domain) => !registeredDomains.has(domain));

  if (uncheckedDomains.length > 0) {
    const batch = await checkDomainsAvailability(uncheckedDomains);

    if (batch.ok && batch.data) {
      for (const item of batch.data) {
        if (!item.available) {
          externallyRegisteredDomains.add(item.domain.toLowerCase());
        }
      }
    } else {
      const registrarProvider = await getRegistrarProvider();
      const externalRegistered = await Promise.all(
        uncheckedDomains.map(async (domain) => ({
          domain,
          registered: await isDomainRegistered(domain, registrarProvider),
        }))
      );
      for (const item of externalRegistered) {
        if (item.registered) {
          externallyRegisteredDomains.add(item.domain);
        }
      }
    }
  }

  const results: DomainAvailabilityResult[] = normalizedExtensions.map((ext) => {
    const domain = `${label}${ext}`;
    const tld = tldMap.get(ext);

    return {
      domain,
      available: !externallyRegisteredDomains.has(domain),
      price: tld?.registerPrice ?? 0,
      renewPrice: tld?.renewPrice ?? 0,
      transfer: tld?.transferPrice ?? 0,
    };
  });

  return {
    success: true,
    data: {
      query: label,
      results,
    },
  };
}

export interface WhoisLookupResult {
  domain: string;
  registrar: string;
  registrant: string;
  createdDate: string;
  expiryDate: string;
  updatedDate: string;
  status: string[];
  nameServers: string[];
  dnssec: string;
}

export async function lookupWhois(domainInput: string) {
  const limit = await checkRateLimit({
    key: `whois:${normalizeRateLimitKey(domainInput)}`,
    limit: 20,
    windowMs: 10 * 60 * 1000,
  });
  if (!limit.allowed) {
    return { success: false, error: "Çok fazla WHOIS sorgusu yapıldı. Lütfen biraz sonra tekrar deneyin." as const };
  }

  const normalizedDomain = normalizeFullDomain(domainInput);
  if (!normalizedDomain) {
    return { success: false, error: "Geçerli bir domain adı girin" as const };
  }

  const domain = await db.domain.findUnique({
    where: { name: normalizedDomain },
    include: {
      customer: {
        select: {
          name: true,
          surname: true,
          companyName: true,
        },
      },
    },
  });

  if (!domain) {
    const rdap = await fetchRdapDomain(normalizedDomain);

    if (rdap) {
      const data: WhoisLookupResult = {
        domain: rdap.ldhName?.toLowerCase() ?? normalizedDomain,
        registrar: getRdapRegistrar(rdap),
        registrant: "REDACTED FOR PRIVACY",
        createdDate: getRdapEventDate(rdap, ["registration", "registered"]),
        expiryDate: getRdapEventDate(rdap, ["expiration", "expiry"]),
        updatedDate: getRdapEventDate(rdap, ["last changed", "last update of rdap database"]),
        status: rdap.status ?? ["unknown"],
        nameServers:
          rdap.nameservers
            ?.map((nameserver) => nameserver.ldhName ?? nameserver.unicodeName)
            .filter((value): value is string => Boolean(value)) ?? [],
        dnssec: rdap.secureDNS?.delegationSigned ? "signed" : "unsigned",
      };

      return { success: true, data };
    }

    return {
      success: false,
      error: "Bu domain için WHOIS kaydı bulunamadı veya domain kayıtlı değil",
    };
  }

  const registrant = domain.privacyEnabled
    ? "REDACTED FOR PRIVACY"
    : domain.customer.companyName ||
      `${domain.customer.name} ${domain.customer.surname}`.trim();

  const nameservers = parseNameservers(domain.nameservers);

  const data: WhoisLookupResult = {
    domain: domain.name,
    registrar: domain.registrar || "KLEACORE Domain Services",
    registrant,
    createdDate: domain.registeredAt.toISOString(),
    expiryDate: domain.expiresAt.toISOString(),
    updatedDate: domain.updatedAt.toISOString(),
    status: mapWhoisStatus(domain.status),
    nameServers:
      nameservers.length > 0
        ? nameservers
        : ["ns1.kleacore.com", "ns2.kleacore.com"],
    dnssec: "unsigned",
  };

  return { success: true, data };
}

const transferRequestSchema = z.object({
  domain: z.string().min(3, "Geçerli bir domain adı girin"),
  eppCode: z
    .string()
    .min(6, "EPP/Auth kodu en az 6 karakter olmalı")
    .max(128, "EPP/Auth kodu çok uzun"),
  email: z.string().email("Geçerli bir e-posta adresi girin"),
});

export async function requestDomainTransfer(formData: FormData) {
  const raw = {
    domain: (formData.get("domain") as string) || "",
    eppCode: (formData.get("eppCode") as string) || "",
    email: (formData.get("email") as string) || "",
  };

  const parsed = transferRequestSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.errors[0]?.message ?? "Geçersiz bilgiler",
    };
  }

  const transferLimit = await checkRateLimit({
    key: `domain-transfer:${normalizeRateLimitKey(parsed.data.email)}:${normalizeRateLimitKey(parsed.data.domain)}`,
    limit: 5,
    windowMs: 60 * 60 * 1000,
  });
  if (!transferLimit.allowed) {
    return { success: false, error: "Çok fazla transfer talebi oluşturuldu. Lütfen daha sonra tekrar deneyin." };
  }

  const normalizedDomain = normalizeFullDomain(parsed.data.domain);
  if (!normalizedDomain) {
    return { success: false, error: "Geçerli bir domain adı girin" };
  }

  const existingDomain = await db.domain.findUnique({
    where: { name: normalizedDomain },
    select: { id: true },
  });

  if (existingDomain) {
    return {
      success: false,
      error: "Bu domain zaten sistemimizde kayıtlı görünüyor",
    };
  }

  const session = await auth();

  if (session?.user?.id) {
    const user = await db.user.findUnique({
      where: { id: session.user.id },
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

    if (!user) {
      return { success: false, error: "Kullanıcı bulunamadı" };
    }

    const transferInput = {
      domain: normalizedDomain,
      eppCode: parsed.data.eppCode,
      email: parsed.data.email,
    };

    const registrarConfig = await getRegistrarConfig();
    if (isGriRegistrarEnabled(registrarConfig)) {
      try {
        return await processAutomatedDomainTransfer(user, transferInput);
      } catch (error) {
        if (error instanceof Error) {
          if (error.message.startsWith("DOMAIN_TLD_NOT_FOUND")) {
            return { success: false, error: "Bu domain uzantısı için transfer fiyatı bulunamadı" };
          }
          if (error.message === "DOMAIN_TRANSFER_PRICE_UNAVAILABLE") {
            return { success: false, error: "Bu domain uzantısı için transfer fiyatı tanımlı değil" };
          }
          if (error.message === "DOMAIN_PRODUCT_NOT_FOUND") {
            return { success: false, error: "Domain ürünü yapılandırması eksik" };
          }
        }

        return { success: false, error: "Domain transferi başlatılırken bir hata oluştu" };
      }
    }

    return createManualDomainTransferTicket(user, transferInput);
  }

  await db.contactMessage.create({
    data: {
      name: "Website Ziyaretçisi",
      email: parsed.data.email,
      subject: `Domain Transfer Talebi: ${normalizedDomain}`,
      message:
        `Domain: ${normalizedDomain}\n` +
        `EPP/Auth Kodu: ${parsed.data.eppCode}\n` +
        "Talep kaynağı: Domain transfer sayfası",
    },
  });

  return {
    success: true,
    message: "Transfer talebiniz alındı. Ekibimiz kısa süre içinde sizinle iletişime geçecek.",
  };
}
