/**
 * Control-panel access for hosting services (Faz 2.6): one-time cPanel /
 * Webmail login URLs, the stored initial panel password (reveal + reset).
 * Server-only. Works for services bound to a server module instance
 * (Service.moduleInstanceId); legacy services must be linked first
 * (admin → hizmet detayı → Otomasyon modülü), docs/modules.md §4.
 *
 * Secrets: the SSO URL embeds a session token and the password is a
 * credential — neither is ever logged, stored in ActivityLog or returned in
 * an error message. The password is stored encrypted (enc:v1:).
 */
import { randomInt } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { createLogger } from "@/lib/logger";
import type { ServerSsoApp } from "@/lib/modules/contracts";
import { decryptSecret, encryptSecret } from "@/lib/secrets/crypto";

const log = createLogger("services.panel-access");

type DbClient = Prisma.TransactionClient | typeof db;

export type PanelLink = "panel" | "webmail" | ServerSsoApp;
export const PANEL_LINKS: readonly PanelLink[] = ["panel", "webmail", "fileManager", "emailAccounts", "phpMyAdmin"];

export function isPanelLink(value: unknown): value is PanelLink {
  return typeof value === "string" && (PANEL_LINKS as readonly string[]).includes(value);
}

/** Who asks: a customer may only act on their own service; an admin on any. */
export type PanelActor = { kind: "customer"; userId: string } | { kind: "admin"; userId: string };

export type PanelAccessError = "NOT_FOUND" | "NOT_ACTIVE" | "NOT_SUPPORTED" | "REMOTE_ERROR" | "NO_PASSWORD";

export type PanelAccessResult<T> = { ok: true; data: T } | { ok: false; error: PanelAccessError; message: string };

const MESSAGES: Record<PanelAccessError, string> = {
  NOT_FOUND: "Hizmet bulunamadı.",
  NOT_ACTIVE: "Bu işlem yalnızca aktif hizmetlerde kullanılabilir.",
  NOT_SUPPORTED: "Bu hizmet için panel erişimi henüz açılmadı. Destek ekibimiz yardımcı olabilir.",
  REMOTE_ERROR: "Kontrol paneline şu anda ulaşılamıyor. Lütfen birazdan tekrar deneyin.",
  NO_PASSWORD: "Bu hizmet için kayıtlı bir şifre yok. Şifreyi sıfırlayarak yenisini oluşturabilirsiniz.",
};

function fail<T>(error: PanelAccessError): PanelAccessResult<T> {
  return { ok: false, error, message: MESSAGES[error] };
}

// ---------------------------------------------------------------------------
// Password helpers
// ---------------------------------------------------------------------------

const LOWER = "abcdefghjkmnpqrstuvwxyz";
const UPPER = "ABCDEFGHJKMNPQRSTUVWXYZ";
const DIGITS = "23456789";
const SYMBOLS = "!@#%*-_";

/** Strong random panel password with every character class (WHM strength check). */
export function generatePanelPassword(length = 18): string {
  const all = LOWER + UPPER + DIGITS + SYMBOLS;
  const chars = [LOWER, UPPER, DIGITS, SYMBOLS].map((set) => set[randomInt(set.length)]);
  while (chars.length < length) chars.push(all[randomInt(all.length)]);
  for (let i = chars.length - 1; i > 0; i -= 1) {
    const j = randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join("");
}

/** Stores a panel password encrypted on the service. */
export async function storeServicePanelPassword(serviceId: string, password: string, client: DbClient = db) {
  await client.service.update({
    where: { id: serviceId },
    data: { panelPassword: encryptSecret(password), panelPasswordSetAt: new Date() },
  });
}

/** Decrypts a stored panel password (null when none / undecryptable). */
export function readStoredPanelPassword(stored: string | null | undefined): string | null {
  if (!stored) return null;
  const value = decryptSecret(stored);
  // decryptSecret returns the input unchanged when the key can't decrypt it.
  return value && !value.startsWith("enc:v1:") ? value : null;
}

// ---------------------------------------------------------------------------
// Service + module resolution
// ---------------------------------------------------------------------------

async function loadService(serviceId: string, actor: PanelActor) {
  const service = await db.service.findUnique({
    where: { id: serviceId },
    include: {
      product: { include: { category: true } },
      customer: { select: { id: true, name: true, surname: true, email: true } },
    },
  });
  // A customer never learns whether someone else's service exists.
  if (!service || (actor.kind === "customer" && service.customerId !== actor.userId)) return null;
  return service;
}

type LoadedService = NonNullable<Awaited<ReturnType<typeof loadService>>>;

async function resolveModule(service: LoadedService) {
  if (!service.moduleInstanceId) return null;
  try {
    const [{ getServerBindingForService }, { buildServerContext }, { parseProductOptions }] = await Promise.all([
      import("@/lib/modules/instances"),
      import("@/lib/modules/server-bridge"),
      import("@/lib/modules/product-options"),
    ]);
    const binding = await getServerBindingForService(service);
    if (!binding) return null;
    const parsed = parseProductOptions(binding.manifest, service.product?.moduleOptions);
    const ctx = buildServerContext(binding.instance, service, parsed.success ? parsed.data : {});
    return { binding, ctx };
  } catch (error) {
    log.warn("server module unavailable", { serviceId: service.id, error });
    return null;
  }
}

function canUse(service: LoadedService, actor: PanelActor) {
  // Admins may also open a suspended account (cPanel itself refuses logins
  // of suspended accounts; the admin sees that message there).
  return service.status === "ACTIVE" || (actor.kind === "admin" && service.status === "SUSPENDED");
}

/** What the panel UI may offer for a service (no remote call). */
export async function getPanelCapabilities(service: { moduleInstanceId: string | null }) {
  if (!service.moduleInstanceId) return { sso: false, passwordReset: false, instanceLabel: null as string | null };
  const row = await db.moduleInstance.findUnique({
    where: { id: service.moduleInstanceId },
    select: { moduleId: true, label: true },
  });
  if (!row) return { sso: false, passwordReset: false, instanceLabel: null };
  const { getModule } = await import("@/lib/modules/registry");
  const capabilities = (getModule(row.moduleId)?.capabilities ?? []) as readonly string[];
  return { sso: capabilities.includes("sso"), passwordReset: capabilities.includes("password"), instanceLabel: row.label };
}

// ---------------------------------------------------------------------------
// Operations
// ---------------------------------------------------------------------------

/**
 * Fresh one-time login URL for cPanel / Webmail / a cPanel app. The caller
 * redirects to it immediately; it is never stored or logged.
 */
export async function createPanelLoginUrl(
  serviceId: string,
  link: PanelLink,
  actor: PanelActor
): Promise<PanelAccessResult<{ url: string; remoteId: string | null; customerId: string }>> {
  const service = await loadService(serviceId, actor);
  if (!service) return fail("NOT_FOUND");
  if (!canUse(service, actor)) return fail("NOT_ACTIVE");

  const resolved = await resolveModule(service);
  const server = resolved?.binding.module;
  if (!resolved || !server?.getSsoUrl) return fail("NOT_SUPPORTED");

  const target = link === "webmail" ? "webmail" : "panel";
  const app = link === "panel" || link === "webmail" ? undefined : link;
  try {
    const result = await server.getSsoUrl(resolved.ctx, target, app ? { app } : undefined);
    if (!result.ok || !result.data?.url) {
      // result.error is the panel's reason text, never the URL.
      log.warn("panel login url failed", { serviceId, link, error: result.error });
      return fail("REMOTE_ERROR");
    }
    return { ok: true, data: { url: result.data.url, remoteId: service.remoteId, customerId: service.customerId } };
  } catch (error) {
    log.warn("panel login url threw", { serviceId, link, error: error instanceof Error ? error.name : "unknown" });
    return fail("REMOTE_ERROR");
  }
}

/** The stored panel password (customer reveal / admin). */
export async function revealPanelPassword(
  serviceId: string,
  actor: PanelActor
): Promise<PanelAccessResult<{ username: string | null; password: string; setAt: Date | null }>> {
  const service = await loadService(serviceId, actor);
  if (!service) return fail("NOT_FOUND");
  if (service.status === "CANCELLED" || service.status === "EXPIRED") return fail("NOT_ACTIVE");
  const password = readStoredPanelPassword(service.panelPassword);
  if (!password) return fail("NO_PASSWORD");
  return {
    ok: true,
    data: { username: service.username ?? service.remoteId, password, setAt: service.panelPasswordSetAt },
  };
}

/**
 * Sets a new random panel password on the remote account and stores it
 * encrypted. The stored value only changes when the panel accepted it.
 */
export async function resetPanelPassword(
  serviceId: string,
  actor: PanelActor
): Promise<PanelAccessResult<{ username: string | null; password: string }>> {
  const service = await loadService(serviceId, actor);
  if (!service) return fail("NOT_FOUND");
  if (service.status !== "ACTIVE") return fail("NOT_ACTIVE");

  const resolved = await resolveModule(service);
  const server = resolved?.binding.module;
  if (!resolved || !server?.resetPassword) return fail("NOT_SUPPORTED");

  const password = generatePanelPassword();
  try {
    const result = await server.resetPassword(resolved.ctx, password);
    if (!result.ok) {
      log.warn("panel password reset failed", { serviceId, error: result.error });
      return fail("REMOTE_ERROR");
    }
  } catch (error) {
    log.warn("panel password reset threw", { serviceId, error: error instanceof Error ? error.name : "unknown" });
    return fail("REMOTE_ERROR");
  }

  await storeServicePanelPassword(service.id, password);
  return { ok: true, data: { username: service.username ?? service.remoteId, password } };
}
