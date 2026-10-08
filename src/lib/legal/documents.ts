import { loadCompanyInfo } from "@/lib/company-info";
import { createHash } from "node:crypto";
import { Prisma, type LegalDocument, type LegalDocumentType } from "@prisma/client";
import { db } from "@/lib/db";
import { DEFAULT_LEGAL_DOCUMENTS } from "./defaults";
import {
  LEGAL_PAYMENT_METHOD_LABELS,
  renderLegalTemplate,
  renderStaticLegalTemplate,
  type LegalBuyer,
  type LegalOrder,
  type LegalRenderContext,
  type LegalSeller,
} from "./render";

type Client = Prisma.TransactionClient | typeof db;

/** Documents the buyer must accept before an order is created. */
export const CHECKOUT_LEGAL_DOCUMENT_TYPES = [
  "PRELIMINARY_INFORMATION",
  "DISTANCE_SALES_CONTRACT",
] as const satisfies readonly LegalDocumentType[];

export const LEGAL_CONSENT_REQUIRED_MESSAGE =
  "Devam etmek için Ön Bilgilendirme Formu'nu ve Mesafeli Satış Sözleşmesi'ni onaylamanız gerekiyor.";
export const LEGAL_CONSENT_OUTDATED_MESSAGE =
  "Sözleşme metinleri güncellendi. Lütfen sayfayı yenileyip güncel metinleri onaylayın.";

export interface AcceptedLegalDocument {
  documentId: string;
  version: number;
}

export function hashLegalSnapshot(snapshot: string) {
  return createHash("sha256").update(snapshot, "utf8").digest("hex");
}

/**
 * Latest published version of a document. Version 1 is created from the
 * built-in defaults the first time it is needed, so a fresh deploy works
 * without running the seed.
 */
export async function getCurrentLegalDocument(
  type: LegalDocumentType,
  client: Client = db
): Promise<LegalDocument> {
  const find = () =>
    client.legalDocument.findFirst({
      where: { type, publishedAt: { not: null, lte: new Date() } },
      orderBy: { version: "desc" },
    });

  const existing = await find();
  if (existing) return existing;

  const fallback = DEFAULT_LEGAL_DOCUMENTS[type];
  try {
    return await client.legalDocument.upsert({
      where: { type_version: { type, version: fallback.version } },
      create: { ...fallback, publishedAt: new Date() },
      update: {},
    });
  } catch (error) {
    // Parallel first use: the other request created it.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const created = await find();
      if (created) return created;
    }
    throw error;
  }
}

export async function getCheckoutLegalDocuments(client: Client = db) {
  return Promise.all(CHECKOUT_LEGAL_DOCUMENT_TYPES.map((type) => getCurrentLegalDocument(type, client)));
}

/**
 * Throws LEGAL_CONSENT_MISSING / LEGAL_CONSENT_OUTDATED unless the buyer
 * accepted exactly the current version of every checkout document.
 */
export function assertCheckoutConsents(
  documents: Pick<LegalDocument, "id" | "version">[],
  accepted: AcceptedLegalDocument[] | undefined
) {
  if (!Array.isArray(accepted) || accepted.length === 0) {
    throw new Error("LEGAL_CONSENT_MISSING");
  }
  for (const document of documents) {
    const match = accepted.find((item) => item?.documentId === document.id);
    if (!match) throw new Error("LEGAL_CONSENT_MISSING");
    if (Number(match.version) !== document.version) throw new Error("LEGAL_CONSENT_OUTDATED");
  }
}

/**
 * Seller block of the contracts, from the shared company info
 * (src/lib/company-info.ts): admin settings override the defaults shown on
 * the site footer; the placeholder phone/address never reach a contract and
 * an unset phone renders as nothing.
 */
export async function getLegalSeller(client: Client = db): Promise<LegalSeller> {
  const company = await loadCompanyInfo(client);
  return {
    name: company.name,
    address: company.address,
    email: company.email,
    phone: company.phone,
    taxId: company.taxId,
    website: company.website,
  };
}

export async function getLegalBuyer(userId: string, client: Client = db): Promise<LegalBuyer | null> {
  const user = await client.user.findUnique({
    where: { id: userId },
    select: {
      name: true,
      surname: true,
      email: true,
      phone: true,
      companyName: true,
      customerType: true,
      address: true,
      city: true,
      country: true,
    },
  });
  if (!user) return null;

  const personName = `${user.name} ${user.surname}`.trim();
  return {
    name:
      user.customerType === "CORPORATE" && user.companyName
        ? `${user.companyName} (${personName})`
        : personName,
    email: user.email,
    phone: user.phone ?? "",
    address: [user.address, user.city, user.country].filter(Boolean).join(", "),
  };
}

export function legalPaymentMethodLabel(method: string) {
  return LEGAL_PAYMENT_METHOD_LABELS[method] ?? method;
}

/**
 * Renders the checkout documents for the server-side order data and stores one
 * ConsentRecord per (order, document). Call inside the checkout transaction so
 * the records commit or roll back with the orders. The (orderId, documentId)
 * unique index guarantees a single record per order and document.
 */
export async function recordCheckoutConsents(
  tx: Prisma.TransactionClient,
  input: {
    userId: string;
    orderIds: string[];
    documents: LegalDocument[];
    seller: LegalSeller;
    buyer: LegalBuyer;
    order: LegalOrder;
    ipAddress: string | null;
    userAgent: string | null;
  }
) {
  const context: LegalRenderContext = { seller: input.seller, buyer: input.buyer, order: input.order };
  const rendered = input.documents.map((document) => {
    const snapshot = renderLegalTemplate(document.content, context);
    return { document, snapshot, snapshotHash: hashLegalSnapshot(snapshot) };
  });

  const data = input.orderIds.flatMap((orderId) =>
    rendered.map(({ document, snapshot, snapshotHash }) => ({
      userId: input.userId,
      orderId,
      documentId: document.id,
      documentType: document.type,
      documentVersion: document.version,
      snapshot,
      snapshotHash,
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
    }))
  );

  return tx.consentRecord.createMany({ data, skipDuplicates: true });
}

/**
 * KVKK aydınlatma acknowledgement given at registration. Load `document` with
 * getCurrentLegalDocument("KVKK_NOTICE") before opening the transaction.
 */
export async function recordKvkkAcknowledgement(
  tx: Prisma.TransactionClient,
  input: { userId: string; document: LegalDocument; ipAddress: string | null; userAgent: string | null }
) {
  const { document } = input;
  const snapshot = renderStaticLegalTemplate(document.content);
  return tx.consentRecord.create({
    data: {
      userId: input.userId,
      documentId: document.id,
      documentType: document.type,
      documentVersion: document.version,
      snapshot,
      snapshotHash: hashLegalSnapshot(snapshot),
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
    },
  });
}

export async function getOrderConsentRecords(orderId: string) {
  return db.consentRecord.findMany({
    where: { orderId },
    orderBy: { acceptedAt: "asc" },
    include: { document: { select: { title: true, isPlaceholder: true } } },
  });
}
