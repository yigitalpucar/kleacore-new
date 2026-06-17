import { hash } from "bcryptjs";
import { db } from "@/lib/db";
import { getCpanelWhmClient } from "@/lib/integrations/provisioning";
import { isCpanelCategory } from "@/lib/integrations/provisioning/categories";
import { CpanelWhmApiError } from "@/lib/integrations/provisioning/providers/cpanel-whm-client";

const LOCAL_PART_PATTERN = /^[a-z0-9._-]+$/i;
const DOMAIN_PATTERN =
  /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/i;
const ALLOWED_QUOTAS = new Set([250, 512, 1024, 2048, 5120, 10240]);
const MIN_PASSWORD_LENGTH = 8;

export interface ServiceEmailAccount {
  id?: string;
  address: string;
  localPart: string;
  quotaMb: number;
  usedMb: number;
  status: string;
  createdAt?: string;
}

export class EmailProvisioningError extends Error {
  constructor(
    message: string,
    readonly code = "EMAIL_PROVISIONING_ERROR"
  ) {
    super(message);
    this.name = "EmailProvisioningError";
  }
}

export function normalizeLocalPart(value: string) {
  return value.trim().toLowerCase();
}

export function normalizeServiceDomain(value: string) {
  return value.trim().toLowerCase();
}

export function buildServiceEmailAddress(localPart: string, serviceDomain: string) {
  const normalizedLocalPart = normalizeLocalPart(localPart);
  const normalizedDomain = normalizeServiceDomain(serviceDomain);

  return `${normalizedLocalPart}@${normalizedDomain}`;
}

export function validateLocalPart(localPart: string) {
  const normalized = normalizeLocalPart(localPart);

  if (!normalized || normalized.length < 2 || normalized.length > 64) {
    return { ok: false as const, error: "Geçerli bir kullanıcı adı girin" };
  }

  if (!LOCAL_PART_PATTERN.test(normalized)) {
    return {
      ok: false as const,
      error: "Kullanıcı adı sadece harf, sayı, nokta, tire ve alt çizgi içerebilir",
    };
  }

  return { ok: true as const, value: normalized };
}

export function validateServiceDomain(domain: string | null | undefined) {
  const normalized = normalizeServiceDomain(domain || "");

  if (!normalized || !DOMAIN_PATTERN.test(normalized)) {
    return { ok: false as const, error: "Hizmet domain bilgisi geçersiz" };
  }

  return { ok: true as const, value: normalized };
}

export function validateEmailAddressForService(address: string, serviceDomain: string) {
  const normalizedAddress = address.trim().toLowerCase();
  const normalizedDomain = normalizeServiceDomain(serviceDomain);
  const atIndex = normalizedAddress.lastIndexOf("@");

  if (atIndex <= 0 || atIndex === normalizedAddress.length - 1) {
    return { ok: false as const, error: "Geçerli bir e-posta adresi girin" };
  }

  const localPart = normalizedAddress.slice(0, atIndex);
  const domain = normalizedAddress.slice(atIndex + 1);

  if (domain !== normalizedDomain) {
    return {
      ok: false as const,
      error: "E-posta adresi hizmet domaini ile eşleşmiyor",
    };
  }

  const localPartValidation = validateLocalPart(localPart);
  if (!localPartValidation.ok) {
    return localPartValidation;
  }

  return {
    ok: true as const,
    value: {
      address: `${localPartValidation.value}@${normalizedDomain}`,
      localPart: localPartValidation.value,
      domain: normalizedDomain,
    },
  };
}

export function normalizeQuotaMb(value?: number) {
  if (!value || Number.isNaN(value)) {
    return 2048;
  }

  if (ALLOWED_QUOTAS.has(value)) {
    return value;
  }

  return 2048;
}

export function validatePassword(password: string) {
  if (!password || password.length < MIN_PASSWORD_LENGTH) {
    return {
      ok: false as const,
      error: `Şifre en az ${MIN_PASSWORD_LENGTH} karakter olmalıdır`,
    };
  }

  return { ok: true as const, value: password };
}

async function loadHostingService(serviceId: string) {
  return db.service.findUnique({
    where: { id: serviceId },
    include: {
      product: {
        include: {
          category: true,
        },
      },
    },
  });
}

function resolveCpanelUsername(service: {
  username: string | null;
  serverName: string | null;
}) {
  return service.username?.trim() || service.serverName?.trim() || "";
}

async function ensureCpanelClient() {
  const client = await getCpanelWhmClient();
  if (!client) {
    throw new EmailProvisioningError("cPanel entegrasyonu yapılandırılmamış", "CPANEL_NOT_CONFIGURED");
  }

  return client;
}

function assertHostingService(
  service: Awaited<ReturnType<typeof loadHostingService>>
) {
  if (!service) {
    throw new EmailProvisioningError("Hizmet bulunamadı", "SERVICE_NOT_FOUND");
  }

  const categorySlug = service.product.category?.slug?.toLowerCase() ?? "";
  if (!isCpanelCategory(categorySlug)) {
    throw new EmailProvisioningError(
      "E-posta hesapları yalnızca hosting hizmetleri için kullanılabilir",
      "SERVICE_NOT_HOSTING"
    );
  }

  const cpanelUser = resolveCpanelUsername(service);
  if (!cpanelUser) {
    throw new EmailProvisioningError(
      "Hizmette cPanel kullanıcı adı tanımlı değil",
      "CPANEL_USERNAME_MISSING"
    );
  }

  const domainValidation = validateServiceDomain(service.domain);
  if (!domainValidation.ok) {
    throw new EmailProvisioningError(domainValidation.error, "SERVICE_DOMAIN_INVALID");
  }

  if (service.status !== "ACTIVE") {
    throw new EmailProvisioningError(
      "Yalnızca aktif hizmetler için e-posta hesabı yönetilebilir",
      "SERVICE_NOT_ACTIVE"
    );
  }

  return {
    service,
    cpanelUser,
    serviceDomain: domainValidation.value,
  };
}

export async function createServiceEmailAccount(input: {
  serviceId: string;
  localPart: string;
  password: string;
  quotaMb?: number;
}) {
  const { service, cpanelUser, serviceDomain } = assertHostingService(
    await loadHostingService(input.serviceId)
  );

  const localPartValidation = validateLocalPart(input.localPart);
  if (!localPartValidation.ok) {
    throw new EmailProvisioningError(localPartValidation.error, "INVALID_LOCAL_PART");
  }

  const passwordValidation = validatePassword(input.password);
  if (!passwordValidation.ok) {
    throw new EmailProvisioningError(passwordValidation.error, "INVALID_PASSWORD");
  }

  const address = buildServiceEmailAddress(localPartValidation.value, serviceDomain);
  const quotaMb = normalizeQuotaMb(input.quotaMb);

  const existing = await db.emailAccount.findUnique({
    where: { email: address },
    select: { id: true, serviceId: true },
  });

  if (existing) {
    throw new EmailProvisioningError("Bu e-posta adresi zaten kullanılıyor", "EMAIL_EXISTS");
  }

  const client = await ensureCpanelClient();

  try {
    await client.createEmailAccount(cpanelUser, address, passwordValidation.value, quotaMb);
  } catch (error) {
    const message =
      error instanceof CpanelWhmApiError
        ? error.message
        : error instanceof Error
          ? error.message
          : "CPANEL_EMAIL_CREATE_FAILED";

    throw new EmailProvisioningError(message, "CPANEL_EMAIL_CREATE_FAILED");
  }

  const passwordHash = await hash(passwordValidation.value, 10);
  const account = await db.emailAccount.create({
    data: {
      customerId: service.customerId,
      serviceId: service.id,
      localPart: localPartValidation.value,
      email: address,
      passwordHash,
      quotaMb,
      usedMb: 0,
      status: "ACTIVE",
    },
  });

  return {
    id: account.id,
    address: account.email,
    localPart: account.localPart,
    quotaMb: account.quotaMb,
    usedMb: account.usedMb,
    status: account.status,
    createdAt: account.createdAt.toISOString(),
  } satisfies ServiceEmailAccount;
}

export async function deleteServiceEmailAccount(input: {
  serviceId: string;
  address: string;
}) {
  const { service, cpanelUser, serviceDomain } = assertHostingService(
    await loadHostingService(input.serviceId)
  );

  const addressValidation = validateEmailAddressForService(input.address, serviceDomain);
  if (!addressValidation.ok) {
    throw new EmailProvisioningError(addressValidation.error, "INVALID_EMAIL_ADDRESS");
  }

  const account = await db.emailAccount.findFirst({
    where: {
      serviceId: service.id,
      email: addressValidation.value.address,
    },
    select: { id: true },
  });

  const client = await ensureCpanelClient();

  try {
    await client.deleteEmailAccount(cpanelUser, addressValidation.value.address);
  } catch (error) {
    const message =
      error instanceof CpanelWhmApiError
        ? error.message
        : error instanceof Error
          ? error.message
          : "CPANEL_EMAIL_DELETE_FAILED";

    throw new EmailProvisioningError(message, "CPANEL_EMAIL_DELETE_FAILED");
  }

  if (account) {
    await db.emailAccount.delete({ where: { id: account.id } });
  }

  return { address: addressValidation.value.address };
}

export async function listServiceEmailAccounts(serviceId: string) {
  const { service, cpanelUser } = assertHostingService(await loadHostingService(serviceId));
  const client = await ensureCpanelClient();

  let remoteAccounts: Awaited<ReturnType<typeof client.listEmailAccounts>> = [];

  try {
    remoteAccounts = await client.listEmailAccounts(cpanelUser);
  } catch (error) {
    const message =
      error instanceof CpanelWhmApiError
        ? error.message
        : error instanceof Error
          ? error.message
          : "CPANEL_EMAIL_LIST_FAILED";

    throw new EmailProvisioningError(message, "CPANEL_EMAIL_LIST_FAILED");
  }

  const localAccounts = await db.emailAccount.findMany({
    where: { serviceId: service.id },
    orderBy: { createdAt: "desc" },
  });

  const localByAddress = new Map(localAccounts.map((account) => [account.email, account]));

  const merged = remoteAccounts.map((remote) => {
    const local = localByAddress.get(remote.address);

    return {
      id: local?.id,
      address: remote.address,
      localPart: local?.localPart || remote.address.split("@")[0] || "",
      quotaMb: remote.quotaMb || local?.quotaMb || 0,
      usedMb: remote.diskUsedMb || local?.usedMb || 0,
      status: local?.status || "ACTIVE",
      createdAt: local?.createdAt.toISOString(),
    } satisfies ServiceEmailAccount;
  });

  for (const local of localAccounts) {
    if (!merged.some((item) => item.address === local.email)) {
      merged.push({
        id: local.id,
        address: local.email,
        localPart: local.localPart,
        quotaMb: local.quotaMb,
        usedMb: local.usedMb,
        status: local.status,
        createdAt: local.createdAt.toISOString(),
      });
    }
  }

  return merged.sort((a, b) => a.address.localeCompare(b.address, "tr-TR"));
}