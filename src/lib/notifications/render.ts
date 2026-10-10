import { db } from "@/lib/db";
import { COMPANY_SETTING_KEYS, companyInfoFromSettings } from "@/lib/company-info";
import { decryptSecret, encryptSecret, isEncryptedValue } from "@/lib/secrets/crypto";
import { getAppBaseUrl } from "@/lib/stripe";
import { LOGO_CID, renderEmailLayout, renderRawEmail, type RenderedEmail } from "./layout";
import { renderOverrideEmail, renderOverrideSms, type TemplateOverride } from "./overrides";
import { LOGO_PNG_BASE64 } from "./logo";
import { getTemplate } from "./templates";
import type { NotificationBrand, NotificationTemplate, RenderContext } from "./templates/types";

export const REDACTED_PLACEHOLDER = "•••••• (gizli)";

const BRAND_KEYS = ["site_name", ...COMPANY_SETTING_KEYS] as const;

const DEFAULT_COMPANY = companyInfoFromSettings({});

export const DEFAULT_BRAND: NotificationBrand = {
  siteName: "KLEACORE",
  companyName: DEFAULT_COMPANY.name,
  companyAddress: DEFAULT_COMPANY.address,
  companyPhone: "",
  supportEmail: DEFAULT_COMPANY.email,
  siteUrl: DEFAULT_COMPANY.website,
};

export async function loadBrand(): Promise<NotificationBrand> {
  const rows = await db.setting.findMany({
    where: { key: { in: [...BRAND_KEYS] } },
    select: { key: true, value: true },
  });
  const settings = Object.fromEntries(rows.map((row) => [row.key, row.value]));
  // Same company block as the contracts and the site footer; placeholder
  // phone/address values are dropped, an unset phone is not rendered.
  const company = companyInfoFromSettings(settings);
  return {
    siteName: settings.site_name?.trim() || DEFAULT_BRAND.siteName,
    companyName: company.name,
    companyAddress: company.address,
    companyPhone: company.phone,
    supportEmail: company.email,
    siteUrl: company.website,
  };
}

export async function loadRenderContext(): Promise<RenderContext> {
  return { brand: await loadBrand(), baseUrl: getAppBaseUrl() };
}

type Data = Record<string, unknown>;

function mapSensitive(template: NotificationTemplate, data: Data, fn: (value: string) => string): Data {
  if (!template.sensitive?.length) return data;
  const next = { ...data };
  for (const key of template.sensitive) {
    const value = next[key];
    if (typeof value === "string" && value) next[key] = fn(value);
  }
  return next;
}

/** Encrypts the template's sensitive fields before data hits the queue / log table. */
export function protectSensitive(template: NotificationTemplate, data: Data): Data {
  return mapSensitive(template, data, (value) => encryptSecret(value));
}

/** Decrypts sensitive fields for the actual send. */
export function revealSensitive(template: NotificationTemplate, data: Data): Data {
  return mapSensitive(template, data, (value) => (isEncryptedValue(value) ? decryptSecret(value) : value));
}

/** Replaces sensitive fields with a placeholder (admin log view, customer inbox copy). */
export function redactSensitive(template: NotificationTemplate, data: Data): Data {
  return mapSensitive(template, data, () => REDACTED_PLACEHOLDER);
}

export function hasSensitiveData(template: NotificationTemplate, data: Data) {
  return Boolean(template.sensitive?.some((key) => typeof data[key] === "string" && data[key]));
}

export interface RenderedNotification extends RenderedEmail {
  sms: string | null;
}

export const LOGO_DATA_URI = `data:image/png;base64,${LOGO_PNG_BASE64}`;

/**
 * Validates `data` with the template schema and renders subject/HTML/text
 * (and the SMS text when the template has one). `logo: "cid"` for real
 * sends (inline attachment), `"inline"` for previews in the browser.
 * `override`: the template's active admin edits (loadTemplateOverride); a
 * missing channel, or an override that fails to render, falls back to the
 * typed TS template.
 */
export function renderNotification(
  templateKey: string,
  data: unknown,
  ctx: RenderContext,
  options: { logo?: "cid" | "inline"; override?: TemplateOverride | null } = {}
): RenderedNotification {
  const template = getTemplate(templateKey);
  const parsed = template.schema.parse(data);
  const logoSrc = options.logo === "inline" ? LOGO_DATA_URI : `cid:${LOGO_CID}`;
  const shell = { logoSrc, eyebrow: template.group };

  let email: RenderedEmail | null = null;
  if (template.renderRaw) {
    email = renderRawEmail(template.renderRaw(parsed, ctx), ctx.brand, shell);
  } else if (options.override?.email) {
    try {
      email = renderOverrideEmail(template, parsed, ctx, options.override.email, shell);
    } catch (error) {
      console.error(`[Notifications] ${templateKey} e-posta şablonu işlenemedi, varsayılan kullanılıyor:`, error);
    }
  }
  email ??= renderEmailLayout(template.render(parsed, ctx), ctx.brand, shell);

  let sms: string | null = template.sms ? template.sms(parsed, ctx) : null;
  if (template.sms && options.override?.sms && !template.renderRaw) {
    try {
      sms = renderOverrideSms(template, parsed, ctx, options.override.sms);
    } catch (error) {
      console.error(`[Notifications] ${templateKey} SMS şablonu işlenemedi, varsayılan kullanılıyor:`, error);
    }
  }
  return { ...email, sms };
}
