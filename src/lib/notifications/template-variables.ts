import { z } from "zod";
import { collectNames, parseTemplate, type TemplateError } from "./template-engine";
import { date, dateField, money, moneyField } from "./templates/helpers";
import type { NotificationTemplate, RenderContext } from "./templates/types";

/**
 * Variables an admin-edited template may use, derived from the template's
 * zod data schema (the whitelist), plus the brand block and the panel URL.
 * Money and dates are pre-formatted ("599,94 ₺", "15.10.2026").
 */

export type VariableKind = "text" | "money" | "date" | "number" | "boolean" | "list" | "objectList";

export interface TemplateVariable {
  name: string;
  kind: VariableKind;
  description: string;
  optional: boolean;
  /** objectList: keys usable inside {{#name}}…{{/name}}. */
  itemKeys?: string[];
}

const DESCRIPTIONS: Record<string, string> = {
  recipientName: "Alıcının adı soyadı",
  invoiceId: "Fatura kimliği (bağlantılar için)",
  invoiceNumber: "Fatura numarası",
  totalAmount: "Fatura tutarı",
  paidAmount: "Ödenen tutar",
  amount: "Tutar",
  dueDate: "Son ödeme tarihi",
  paidAt: "Ödeme tarihi",
  refundedAt: "İade tarihi",
  suspendAt: "Askıya alma tarihi",
  suspendAfterDays: "Vadeden kaç gün sonra askıya alınacağı",
  daysLeft: "Kalan gün",
  orderNumbers: "Sipariş numaraları",
  paymentMethod: "Ödeme yöntemi kodu",
  isPaid: "Ödendi mi",
  promoCode: "Kupon kodu",
  reason: "Sebep / açıklama",
  method: "Yöntem",
  serviceId: "Hizmet kimliği (bağlantılar için)",
  serviceLabel: "Hizmet adı",
  suspendedAt: "Askıya alınma tarihi",
  cancelledAt: "İptal tarihi",
  kind: "Hizmet türü (hosting / server / other)",
  domain: "Alan adı",
  username: "Kullanıcı adı",
  panelUrl: "Panel adresi",
  nameservers: "Ad sunucuları",
  ipAddress: "IP adresi",
  hostname: "Sunucu adı",
  password: "İlk şifre (gizli alan)",
  passwordDelivery: "Şifre teslim şekli (included / separately / panel)",
  notes: "Not",
  expiresAt: "Bitiş tarihi",
  graceEndsAt: "Ek süre bitişi",
  stage: "Aşama",
  autoRenew: "Otomatik yenileme açık mı",
  renewUrl: "Yenileme bağlantısı",
  years: "Yıl",
  transfer: "Transfer mi",
  ticketId: "Talep kimliği",
  ticketNumber: "Talep numarası",
  ticketSubject: "Talep konusu",
  senderName: "Yanıtlayan",
  messagePreview: "Mesaj özeti",
  verifyUrl: "Doğrulama bağlantısı (gizli alan)",
  resetUrl: "Şifre sıfırlama bağlantısı (gizli alan)",
  inviteUrl: "Davet bağlantısı (gizli alan)",
  expiresInHours: "Geçerlilik (saat)",
  expiresInDays: "Geçerlilik (gün)",
  ttlMinutes: "Geçerlilik (dakika)",
  changedAt: "Değişiklik zamanı",
  summary: "Özet",
  title: "Başlık",
  message: "Mesaj",
  details: "Ayrıntılar (label / value listesi)",
  path: "Yönetim paneli yolu",
  eventType: "Olay türü",
  automatic: "Otomatik tahsilat mı",
  card: "Kart (maskeli, ör. Visa •••• 4242)",
  attempt: "Deneme sırası",
  maxAttempts: "En fazla deneme",
  autoPay: "Otomatik ödeme açık mı",
  closesAt: "Otomatik kapanma zamanı",
  hasAccount: "Müşteri hesabı var mı",
  replyTo: "Yanıt adresi (destek posta kutusu)",
  roleLabel: "Personel rolü (ör. Destek)",
  invitedBy: "Davet eden",
  receipt: "Makbuz mu",
};

const KIND_LABEL: Record<VariableKind, string> = {
  text: "metin",
  money: "tutar, ₺ biçimli",
  date: "tarih",
  number: "sayı",
  boolean: "evet/hayır — {{#ad}}…{{/ad}} bloğunda kullanın",
  list: "liste — virgülle birleşir veya {{#ad}}{{.}}{{/ad}}",
  objectList: "liste — {{#ad}}…{{/ad}} bloğunda alanlarıyla",
};

export const GLOBAL_VARIABLES: TemplateVariable[] = [
  { name: "brand.siteName", kind: "text", description: "Site adı (Ayarlar)", optional: false },
  { name: "brand.companyName", kind: "text", description: "Firma unvanı", optional: false },
  { name: "brand.companyAddress", kind: "text", description: "Firma adresi", optional: true },
  { name: "brand.companyPhone", kind: "text", description: "Firma telefonu", optional: true },
  { name: "brand.supportEmail", kind: "text", description: "Destek e-postası", optional: false },
  { name: "brand.siteUrl", kind: "text", description: "Site adresi", optional: false },
  { name: "baseUrl", kind: "text", description: "Panel adresi (bağlantılar için, sonda / yok)", optional: false },
];

function unwrap(schema: z.ZodTypeAny): { inner: z.ZodTypeAny; optional: boolean } {
  let inner = schema;
  let optional = false;
  for (;;) {
    if (inner === moneyField || inner === dateField) return { inner, optional };
    if (inner instanceof z.ZodOptional || inner instanceof z.ZodNullable) {
      optional = true;
      inner = inner._def.innerType;
    } else if (inner instanceof z.ZodDefault) {
      optional = true;
      inner = inner._def.innerType;
    } else {
      return { inner, optional };
    }
  }
}

function kindOf(schema: z.ZodTypeAny): { kind: VariableKind; itemKeys?: string[] } {
  if (schema === moneyField) return { kind: "money" };
  if (schema === dateField) return { kind: "date" };
  if (schema instanceof z.ZodNumber) return { kind: "number" };
  if (schema instanceof z.ZodBoolean) return { kind: "boolean" };
  if (schema instanceof z.ZodArray) {
    const element = unwrap(schema._def.type).inner;
    if (element instanceof z.ZodObject) return { kind: "objectList", itemKeys: Object.keys(element.shape) };
    return { kind: "list" };
  }
  return { kind: "text" };
}

function shapeOf(template: NotificationTemplate): Record<string, z.ZodTypeAny> {
  let schema: z.ZodTypeAny = template.schema;
  while (schema instanceof z.ZodEffects) schema = schema._def.schema;
  return schema instanceof z.ZodObject ? (schema.shape as Record<string, z.ZodTypeAny>) : {};
}

/** The template's own variables (from its data schema). */
export function describeTemplateVariables(template: NotificationTemplate): TemplateVariable[] {
  return Object.entries(shapeOf(template)).map(([name, field]) => {
    const { inner, optional } = unwrap(field);
    const { kind, itemKeys } = kindOf(inner);
    const base = DESCRIPTIONS[name] ?? name;
    return { name, kind, optional, itemKeys, description: `${base} (${KIND_LABEL[kind]}${optional ? ", boş olabilir" : ""})` };
  });
}

export function allTemplateVariables(template: NotificationTemplate) {
  return [...describeTemplateVariables(template), ...GLOBAL_VARIABLES];
}

/**
 * Values for a parsed (schema output) data object: money and dates formatted
 * for display, brand + baseUrl added.
 */
export function buildTemplateView(
  template: NotificationTemplate,
  data: Record<string, unknown>,
  ctx: RenderContext
): Record<string, unknown> {
  const view: Record<string, unknown> = {};
  for (const variable of describeTemplateVariables(template)) {
    const value = data[variable.name];
    if (value === undefined || value === null) continue;
    if (variable.kind === "money") view[variable.name] = money(String(value));
    else if (variable.kind === "date") view[variable.name] = value instanceof Date ? date(value) : date(new Date(String(value)));
    else view[variable.name] = value;
  }
  return { ...view, brand: { ...ctx.brand }, baseUrl: ctx.baseUrl };
}

export interface TemplateFieldError extends TemplateError {
  field: string;
}

/**
 * Save-time validation: syntax, and every {{name}} / {{#name}} must be a
 * whitelisted variable (or, inside a list block, one of the item's keys).
 */
export function validateTemplateFields(template: NotificationTemplate, fields: Record<string, string>): TemplateFieldError[] {
  const variables = allTemplateVariables(template);
  const byName = new Map(variables.map((variable) => [variable.name, variable]));
  const errors: TemplateFieldError[] = [];

  for (const [field, source] of Object.entries(fields)) {
    const parsed = parseTemplate(source);
    if (!parsed.ok) {
      errors.push(...parsed.errors.map((error) => ({ ...error, field })));
      continue;
    }
    for (const use of collectNames(parsed.nodes)) {
      if (byName.has(use.name)) continue;
      // Inside {{#list}}: "." and the item's own keys.
      const inList = use.scope.some((scopeName) => {
        const variable = byName.get(scopeName);
        if (!variable) return false;
        if (use.name === ".") return variable.kind === "list" || variable.kind === "objectList";
        return variable.kind === "objectList" && (variable.itemKeys ?? []).includes(use.name);
      });
      if (inList) continue;
      errors.push({
        field,
        offset: use.offset,
        message:
          use.name === "."
            ? "{{.}} yalnızca bir liste bloğunun içinde kullanılabilir."
            : `Bilinmeyen değişken: {{${use.name}}}. Bu şablonda kullanılabilecek değişkenler listede.`,
      });
    }
  }
  return errors;
}
