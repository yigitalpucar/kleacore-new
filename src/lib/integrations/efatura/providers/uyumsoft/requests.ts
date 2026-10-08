import { buildUblInvoiceXml } from "../../ubl";
import { el, text } from "../../xml";
import type { EInvoiceDocument } from "../../types";
import { TEMPURI_NS } from "./soap";

/** Uyumsoft wants e-Arşiv/e-Fatura numbers as SSSYYYYNNNNNNNNN; an empty ID lets it assign one. */
export function documentIdForUyumsoft(doc: EInvoiceDocument) {
  return doc.number;
}

export function buildSendInvoiceBody(doc: EInvoiceDocument, now = new Date()): string {
  const invoiceXml = buildUblInvoiceXml(doc, {
    rootName: "Invoice",
    // Inherit the tempuri default namespace from <SendInvoice>; UBL children are prefixed.
    rootAttrs: {},
    id: documentIdForUyumsoft(doc),
  });

  const isArchive = doc.type === "e-arsiv";
  const sale = doc.internetSale;

  const info = el(
    "InvoiceInfo",
    { LocalDocumentId: doc.invoiceId, ExtraInformation: doc.seriesPrefix || undefined },
    invoiceXml,
    el("TargetCustomer", {
      VknTckn: doc.customer.identifier,
      Alias: isArchive ? undefined : doc.customerAlias,
      Title: doc.customer.name,
    }),
    isArchive
      ? el(
          "EArchiveInvoiceInfo",
          { DeliveryType: "Electronic" },
          sale
            ? el(
                "InternetSalesInfo",
                null,
                text("WebAddress", sale.website),
                text("PaymentMidierName", sale.paymentMediator),
                text("PaymentType", sale.paymentType),
                text("PaymentDate", sale.paymentDate.toISOString())
              )
            : ""
        )
      : "",
    text("Scenario", isArchive ? "eArchive" : "eInvoice"),
    isArchive && doc.notificationEmail
      ? el(
          "Notification",
          null,
          el("Mailing", { EnableNotification: "true", To: doc.notificationEmail }, text("Subject", `${doc.supplier.name} e-Arşiv faturanız`))
        )
      : "",
    text("CreateDateUtc", now.toISOString())
  );

  return el("SendInvoice", { xmlns: TEMPURI_NS }, el("invoices", null, info));
}

export function buildIsEInvoiceUserBody(vknTckn: string) {
  return el("IsEInvoiceUser", { xmlns: TEMPURI_NS }, text("vknTckn", vknTckn));
}

export function buildGetUserAliasesBody(vknTckn: string) {
  return el("GetUserAliasses", { xmlns: TEMPURI_NS }, text("vknTckn", vknTckn));
}

export function buildQueryOutboxStatusBody(uuids: string[]) {
  return el(
    "QueryOutboxInvoiceStatus",
    { xmlns: TEMPURI_NS },
    el("invoiceIds", null, uuids.map((uuid) => text("string", uuid)))
  );
}

export function buildGetOutboxPdfBody(uuid: string) {
  return el("GetOutboxInvoicePdf", { xmlns: TEMPURI_NS }, text("invoiceId", uuid));
}

export function buildCancelEArchiveBody(uuid: string, cancelDate: Date) {
  return el(
    "CancelEArchiveInvoice",
    { xmlns: TEMPURI_NS },
    el("request", { InvoiceId: uuid, CancelDate: cancelDate.toISOString() })
  );
}

export function buildEmptyBody(action: "TestConnection" | "WhoAmI") {
  return el(action, { xmlns: TEMPURI_NS });
}
