/**
 * Renders a legal document template (HTML with `{{path}}` variables) for one
 * order. Pure and dependency-free so the checkout modal (client) and the
 * consent snapshot (server) render with the same code.
 *
 * Every value is HTML-escaped; `{{order.items_table}}` is the only variable
 * that expands to markup, generated here from escaped cells. Unknown
 * variables render as an empty string.
 */

export interface LegalSeller {
  name: string;
  address: string;
  email: string;
  phone: string;
  taxId: string;
  website: string;
}

export interface LegalBuyer {
  name: string;
  email: string;
  phone: string;
  address: string;
}

export interface LegalOrderItem {
  name: string;
  quantity: number;
  /** "Aylık", "Yıllık", ... */
  period: string;
  /** KDV hariç satır tutarı (TL). */
  lineTotal: number;
}

export interface LegalOrder {
  /** Already formatted date (tr-TR). */
  date: string;
  /** Order numbers, or a note when they don't exist yet (preview). */
  numbers: string;
  items: LegalOrderItem[];
  subtotal: number;
  discount: number;
  taxRate: number;
  tax: number;
  total: number;
  paymentMethod: string;
}

export interface LegalRenderContext {
  seller: LegalSeller;
  buyer: LegalBuyer;
  order: LegalOrder;
}

const moneyFormatter = new Intl.NumberFormat("tr-TR", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatLegalMoney(value: number) {
  return `${moneyFormatter.format(Math.round(value * 100) / 100)} TL`;
}

export function escapeLegalHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export const LEGAL_PAYMENT_METHOD_LABELS: Record<string, string> = {
  CREDIT_CARD: "Kredi kartı / banka kartı (3D Secure)",
  BANK_TRANSFER: "Banka havalesi / EFT",
  BALANCE: "Hesap bakiyesi",
};

function itemsTable(order: LegalOrder) {
  const rows = order.items
    .map(
      (item) =>
        `<tr><td>${escapeLegalHtml(item.name)}</td><td>${escapeLegalHtml(item.period)}</td>` +
        `<td style="text-align:right">${item.quantity}</td>` +
        `<td style="text-align:right">${escapeLegalHtml(formatLegalMoney(item.lineTotal))}</td></tr>`
    )
    .join("");
  const discountRow =
    order.discount > 0
      ? `<tr><td colspan="3">İndirim</td><td style="text-align:right">−${escapeLegalHtml(formatLegalMoney(order.discount))}</td></tr>`
      : "";

  return (
    `<table class="legal-items"><thead><tr><th>Hizmet</th><th>Dönem</th><th style="text-align:right">Adet</th>` +
    `<th style="text-align:right">Tutar (KDV hariç)</th></tr></thead><tbody>${rows}</tbody><tfoot>` +
    `<tr><td colspan="3">Ara toplam (KDV hariç)</td><td style="text-align:right">${escapeLegalHtml(formatLegalMoney(order.subtotal))}</td></tr>` +
    discountRow +
    `<tr><td colspan="3">KDV (%${escapeLegalHtml(String(order.taxRate))})</td><td style="text-align:right">${escapeLegalHtml(formatLegalMoney(order.tax))}</td></tr>` +
    `<tr><th colspan="3">Toplam (KDV dahil)</th><th style="text-align:right">${escapeLegalHtml(formatLegalMoney(order.total))}</th></tr>` +
    `</tfoot></table>`
  );
}

function variables(context: LegalRenderContext): Record<string, string> {
  const { seller, buyer, order } = context;
  return {
    "seller.name": seller.name,
    "seller.address": seller.address,
    "seller.email": seller.email,
    "seller.phone": seller.phone,
    "seller.tax_id": seller.taxId,
    "seller.website": seller.website,
    "buyer.name": buyer.name,
    "buyer.email": buyer.email,
    "buyer.phone": buyer.phone || "—",
    "buyer.address": buyer.address || "—",
    "order.date": order.date,
    "order.numbers": order.numbers,
    "order.subtotal": formatLegalMoney(order.subtotal),
    "order.discount": formatLegalMoney(order.discount),
    "order.tax_rate": String(order.taxRate),
    "order.tax": formatLegalMoney(order.tax),
    "order.total": formatLegalMoney(order.total),
    "order.payment_method": order.paymentMethod,
  };
}

/** The "· Telefon: {{seller.phone}}" segment, dropped when the seller has no real phone. */
const SELLER_PHONE_SEGMENT = /(?:\s*·\s*)?Telefon:\s*\{\{\s*seller\.phone\s*\}\}/g;

export function renderLegalTemplate(template: string, context: LegalRenderContext) {
  const values = variables(context);
  // No seller phone configured: drop the whole "Telefon:" segment instead of
  // printing an empty (or placeholder) number in a contract.
  const source = context.seller.phone.trim() ? template : template.replace(SELLER_PHONE_SEGMENT, "");
  return source.replace(/\{\{\s*([a-z_.]+)\s*\}\}/g, (_match, name: string) => {
    if (name === "order.items_table") return itemsTable(context.order);
    return escapeLegalHtml(values[name] ?? "");
  });
}

/** Plain template (no order), e.g. the KVKK notice: variables render empty. */
export function renderStaticLegalTemplate(template: string) {
  return template.replace(/\{\{\s*[a-z_.]+\s*\}\}/g, "");
}
