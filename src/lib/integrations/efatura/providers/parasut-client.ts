import type { EInvoiceDraft } from "../types";
import type { ParasutCredentials } from "./parasut-credentials";

const API_BASE = "https://api.parasut.com";
const REQUEST_TIMEOUT_MS = 20000;

interface ParasutToken {
  accessToken: string;
  expiresAt: number;
}

interface ParasutJsonApiResource<TAttributes = Record<string, unknown>> {
  id?: string;
  type: string;
  attributes?: TAttributes;
}

interface ParasutJsonApiResponse<T = ParasutJsonApiResource> {
  data?: T | T[];
  errors?: Array<{ title?: string; detail?: string }>;
}

let cachedToken: ParasutToken | null = null;
let cachedCredentialsKey: string | null = null;

function credentialsKey(credentials: ParasutCredentials) {
  return `${credentials.clientId}:${credentials.username}:${credentials.companyId}`;
}

function extractErrorMessage(body: ParasutJsonApiResponse | null, fallback: string) {
  const detail = body?.errors?.[0]?.detail ?? body?.errors?.[0]?.title;
  return detail || fallback;
}

async function fetchParasutToken(credentials: ParasutCredentials): Promise<string> {
  const key = credentialsKey(credentials);
  if (cachedToken && cachedCredentialsKey === key && cachedToken.expiresAt > Date.now()) {
    return cachedToken.accessToken;
  }

  const body = new URLSearchParams({
    grant_type: "password",
    client_id: credentials.clientId,
    client_secret: credentials.clientSecret,
    username: credentials.username,
    password: credentials.password,
    redirect_uri: "urn:ietf:wg:oauth:2.0:oob",
  });

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(`${API_BASE}/oauth/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
      signal: controller.signal,
    });

    const payload = (await response.json()) as {
      access_token?: string;
      expires_in?: number;
      error?: string;
      error_description?: string;
    };

    if (!response.ok || !payload.access_token) {
      throw new Error(payload.error_description || payload.error || "PARASUT_AUTH_FAILED");
    }

    const expiresIn = payload.expires_in ?? 3600;
    cachedToken = {
      accessToken: payload.access_token,
      expiresAt: Date.now() + Math.max(60, expiresIn - 60) * 1000,
    };
    cachedCredentialsKey = key;

    return payload.access_token;
  } finally {
    clearTimeout(timeout);
  }
}

async function parasutRequest<T>(
  credentials: ParasutCredentials,
  path: string,
  init?: RequestInit
): Promise<T> {
  const token = await fetchParasutToken(credentials);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(`${API_BASE}${path}`, {
      ...init,
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Accept: "application/json",
        ...(init?.headers ?? {}),
      },
    });

    const payload = (await response.json()) as T & ParasutJsonApiResponse;

    if (!response.ok) {
      throw new Error(extractErrorMessage(payload, `PARASUT_HTTP_${response.status}`));
    }

    return payload;
  } finally {
    clearTimeout(timeout);
  }
}

async function findContactByEmail(credentials: ParasutCredentials, email: string) {
  const encodedEmail = encodeURIComponent(email);
  const response = await parasutRequest<ParasutJsonApiResponse>(
    credentials,
    `/v4/${credentials.companyId}/contacts?filter[email]=${encodedEmail}&page[size]=1`
  );

  if (Array.isArray(response.data) && response.data.length > 0) {
    return response.data[0];
  }

  return null;
}

async function createContact(
  credentials: ParasutCredentials,
  draft: EInvoiceDraft,
  email?: string
) {
  const customer = draft.ubl.customer;
  const isCorporate = customer.taxScheme === "VKN";

  const response = await parasutRequest<ParasutJsonApiResponse>(
    credentials,
    `/v4/${credentials.companyId}/contacts`,
    {
      method: "POST",
      body: JSON.stringify({
        data: {
          type: "contacts",
          attributes: {
            email: email || undefined,
            name: customer.partyName,
            contact_type: isCorporate ? "company" : "person",
            tax_number: customer.taxNumber,
            tax_office: customer.taxOffice,
            city: customer.address?.city,
            address: customer.address?.street,
            country: customer.address?.country ?? "Türkiye",
            account_type: "customer",
          },
        },
      }),
    }
  );

  if (!response.data || Array.isArray(response.data) || !response.data.id) {
    throw new Error("PARASUT_CONTACT_CREATE_FAILED");
  }

  return response.data;
}

async function resolveContact(credentials: ParasutCredentials, draft: EInvoiceDraft) {
  const invoice = await import("@/lib/db").then(({ db }) =>
    db.invoice.findUnique({
      where: { id: draft.invoiceId },
      select: { customer: { select: { email: true } } },
    })
  );

  const email = invoice?.customer.email;
  if (email) {
    const existing = await findContactByEmail(credentials, email);
    if (existing?.id) {
      return existing;
    }
  }

  return createContact(credentials, draft, email);
}

async function createSalesInvoice(
  credentials: ParasutCredentials,
  draft: EInvoiceDraft,
  contactId: string
) {
  const issueDate = draft.ubl.issueDate;
  const details = draft.ubl.invoiceLines.map((line) => ({
    type: "sales_invoice_details",
    attributes: {
      quantity: line.quantity,
      unit_price: line.unitPrice,
      vat_rate: line.taxPercent,
      description: line.description,
    },
  }));

  const response = await parasutRequest<ParasutJsonApiResponse>(
    credentials,
    `/v4/${credentials.companyId}/sales_invoices`,
    {
      method: "POST",
      body: JSON.stringify({
        data: {
          type: "sales_invoices",
          attributes: {
            item_type: "invoice",
            description: `KLEACORE ${draft.invoiceNumber}`,
            issue_date: issueDate,
            due_date: issueDate,
            invoice_series: draft.invoiceNumber.replace(/\d+/g, "").slice(0, 3) || "KLE",
            invoice_id: Number(draft.invoiceNumber.replace(/\D/g, "")) || undefined,
            currency: "TRL",
            invoice_discount_type: "amount",
            invoice_discount: 0,
            cash_sale: true,
          },
          relationships: {
            contact: {
              data: { id: contactId, type: "contacts" },
            },
            details: { data: details },
          },
        },
      }),
    }
  );

  if (!response.data || Array.isArray(response.data) || !response.data.id) {
    throw new Error("PARASUT_SALES_INVOICE_CREATE_FAILED");
  }

  return response.data;
}

async function createElectronicDocument(
  credentials: ParasutCredentials,
  draft: EInvoiceDraft,
  salesInvoiceId: string
) {
  const resourceType = draft.type === "e-fatura" ? "e_invoices" : "e_archives";
  const path = `/v4/${credentials.companyId}/${resourceType}`;

  const response = await parasutRequest<ParasutJsonApiResponse>(
    credentials,
    path,
    {
      method: "POST",
      body: JSON.stringify({
        data: {
          type: resourceType,
          attributes: {
            vat_withholding_code: null,
            vat_exemption_reason_code: null,
            note: `KLEACORE ${draft.invoiceNumber}`,
          },
          relationships: {
            invoice: {
              data: { id: salesInvoiceId, type: "sales_invoices" },
            },
          },
        },
      }),
    }
  );

  if (!response.data || Array.isArray(response.data)) {
    throw new Error(`PARASUT_${resourceType.toUpperCase()}_CREATE_FAILED`);
  }

  return response.data;
}

export async function submitParasutEInvoiceDraft(
  credentials: ParasutCredentials,
  draft: EInvoiceDraft
) {
  const contact = await resolveContact(credentials, draft);
  const salesInvoice = await createSalesInvoice(credentials, draft, contact.id!);
  const electronic = await createElectronicDocument(credentials, draft, salesInvoice.id!);

  return {
    documentUuid: electronic.id ?? draft.ubl.uuid,
    documentNumber: salesInvoice.attributes?.invoice_no
      ? String(salesInvoice.attributes.invoice_no)
      : draft.ubl.id,
    providerResponse: {
      contactId: contact.id,
      salesInvoiceId: salesInvoice.id,
      electronicDocumentId: electronic.id,
      electronicDocumentType: draft.type,
    },
  };
}

export async function checkParasutConnection(credentials: ParasutCredentials) {
  await fetchParasutToken(credentials);
  await parasutRequest<ParasutJsonApiResponse>(
    credentials,
    `/v4/${credentials.companyId}/contacts?page[size]=1`
  );
  return true;
}