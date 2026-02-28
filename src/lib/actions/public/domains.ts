"use server";

import { z } from "zod";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
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
import { generateTicketNumber } from "@/lib/utils/number-generators";
import { revalidatePath } from "next/cache";
import type { DomainStatus } from "@prisma/client";

const DOMAIN_LABEL_REGEX = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;
const FULL_DOMAIN_REGEX =
  /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/;

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

  const results: DomainAvailabilityResult[] = normalizedExtensions.map((ext) => {
    const domain = `${label}${ext}`;
    const tld = tldMap.get(ext);

    return {
      domain,
      available: !registeredDomains.has(domain),
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
      },
    });

    if (!user) {
      return { success: false, error: "Kullanıcı bulunamadı" };
    }

    const existingOpenTicket = await db.supportTicket.findFirst({
      where: {
        customerId: user.id,
        subject: `Domain transfer talebi: ${normalizedDomain}`,
        status: {
          not: "CLOSED",
        },
      },
      select: {
        id: true,
        ticketNumber: true,
      },
    });

    if (existingOpenTicket) {
      return {
        success: true,
        message: "Bu domain için açık transfer talebiniz zaten mevcut",
        data: {
          ticketNumber: existingOpenTicket.ticketNumber,
        },
      };
    }

    const senderName = `${user.name} ${user.surname}`.trim() || "Müşteri";
    const ticketNumber = generateTicketNumber();

    await db.supportTicket.create({
      data: {
        ticketNumber,
        customerId: user.id,
        subject: `Domain transfer talebi: ${normalizedDomain}`,
        department: "SALES",
        priority: "MEDIUM",
        status: "OPEN",
        messages: {
          create: {
            senderId: user.id,
            senderName,
            senderRole: "CUSTOMER",
            message:
              `Domain: ${normalizedDomain}\n` +
              `EPP/Auth Kodu: ${parsed.data.eppCode}\n` +
              `İletişim E-postası: ${parsed.data.email}`,
          },
        },
      },
    });

    revalidatePath("/musteri/panel/destek");
    revalidatePath("/yonetim/destek");

    return {
      success: true,
      message: "Transfer talebiniz alındı. Destek talebi oluşturuldu.",
      data: { ticketNumber },
    };
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
