import { createHash } from "node:crypto";
import type { CustomerType, KycDocumentType } from "@prisma/client";
import { generateStorageKey, getStorageDriver, type StorageDriver } from "@/lib/storage";
import { sniffFile, type SniffedKind } from "@/lib/storage/sniff";
import { sanitizeFileName } from "@/lib/support/attachments";

/**
 * KYC upload validation (docs/fraud-kyc.md). Strict on purpose: only images
 * and PDF, detected from the content (magic bytes), the extension must agree,
 * one file per document type, 8 MB each.
 */

export const KYC_MAX_FILE_BYTES = 8 * 1024 * 1024;
export const KYC_DOCUMENT_TYPES = ["IDENTITY_FRONT", "IDENTITY_BACK", "TAX_CERTIFICATE", "SELFIE"] as const satisfies readonly KycDocumentType[];
export const KYC_MAX_FILES = KYC_DOCUMENT_TYPES.length;
/** Whole multipart request: all files + fields + overhead. */
export const KYC_MAX_REQUEST_BYTES = KYC_MAX_FILES * KYC_MAX_FILE_BYTES + 256 * 1024;

export const KYC_ACCEPT = ".jpg,.jpeg,.png,.webp,.pdf";
export const KYC_FILE_HINT = "JPG, PNG, WEBP veya PDF · dosya başına en fazla 8 MB";

export const KYC_DOCUMENT_LABELS: Record<KycDocumentType, string> = {
  IDENTITY_FRONT: "Kimlik kartı — ön yüz",
  IDENTITY_BACK: "Kimlik kartı — arka yüz",
  TAX_CERTIFICATE: "Vergi levhası",
  SELFIE: "Kimlikle birlikte fotoğraf (isteğe bağlı)",
};

const ALLOWED: Partial<Record<SniffedKind, Record<string, string>>> = {
  jpeg: { jpg: "image/jpeg", jpeg: "image/jpeg" },
  png: { png: "image/png" },
  webp: { webp: "image/webp" },
  pdf: { pdf: "application/pdf" },
};

export interface KycFileInput {
  type: string;
  name: string;
  data: Buffer;
}

export interface ValidKycFile {
  type: KycDocumentType;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  sha256: string;
  data: Buffer;
}

export function isKycDocumentType(value: unknown): value is KycDocumentType {
  return typeof value === "string" && (KYC_DOCUMENT_TYPES as readonly string[]).includes(value);
}

function extensionOf(fileName: string) {
  const dot = fileName.lastIndexOf(".");
  return dot > 0 ? fileName.slice(dot + 1).toLowerCase() : "";
}

export function validateKycFile(input: KycFileInput): { ok: true; file: ValidKycFile } | { ok: false; error: string } {
  if (!isKycDocumentType(input.type)) return { ok: false, error: "Geçersiz belge türü." };
  const label = KYC_DOCUMENT_LABELS[input.type];
  const fileName = sanitizeFileName(input.name);

  if (input.data.length === 0) return { ok: false, error: `${label}: dosya boş.` };
  if (input.data.length > KYC_MAX_FILE_BYTES) return { ok: false, error: `${label}: dosya 8 MB sınırını aşıyor.` };

  const sniffed = sniffFile(input.data);
  const byExtension = sniffed.ok ? ALLOWED[sniffed.kind] : undefined;
  if (!byExtension) return { ok: false, error: `${label}: yalnızca JPG, PNG, WEBP veya PDF yükleyebilirsiniz.` };
  const mimeType = byExtension[extensionOf(fileName)];
  if (!mimeType) return { ok: false, error: `${label}: dosya uzantısı içerikle uyuşmuyor.` };

  return {
    ok: true,
    file: {
      type: input.type,
      fileName,
      mimeType,
      sizeBytes: input.data.length,
      sha256: createHash("sha256").update(input.data).digest("hex"),
      data: input.data,
    },
  };
}

/**
 * A complete submission: identity card front + back, or (corporate
 * customers) the tax certificate; selfie optional; one file per type.
 */
export function validateKycSubmission(
  inputs: KycFileInput[],
  customerType: CustomerType
): { ok: true; files: ValidKycFile[] } | { ok: false; error: string } {
  if (inputs.length === 0) return { ok: false, error: "Yüklenecek belge seçilmedi." };
  if (inputs.length > KYC_MAX_FILES) return { ok: false, error: `En fazla ${KYC_MAX_FILES} dosya yükleyebilirsiniz.` };

  const files: ValidKycFile[] = [];
  const seen = new Set<string>();
  for (const input of inputs) {
    if (seen.has(input.type)) return { ok: false, error: "Her belge türü için tek dosya yükleyin." };
    seen.add(input.type);
    const result = validateKycFile(input);
    if (!result.ok) return result;
    files.push(result.file);
  }

  const hasIdentity = seen.has("IDENTITY_FRONT") && seen.has("IDENTITY_BACK");
  const hasTax = seen.has("TAX_CERTIFICATE");
  if (hasTax && customerType !== "CORPORATE") {
    return { ok: false, error: "Vergi levhası yalnızca kurumsal hesaplar için kabul edilir; kimlik kartınızın iki yüzünü yükleyin." };
  }
  if (!hasIdentity && !hasTax) {
    return {
      ok: false,
      error:
        customerType === "CORPORATE"
          ? "Vergi levhasını veya yetkilinin kimlik kartının iki yüzünü yükleyin."
          : "Kimlik kartınızın ön ve arka yüzünü yükleyin.",
    };
  }
  return { ok: true, files };
}

export interface StoredKycFile extends Omit<ValidKycFile, "data"> {
  storageDriver: string;
  storageKey: string;
}

/** Writes the files under fresh random keys (private storage); on failure, already written ones are removed. */
export async function storeKycFiles(files: ValidKycFile[], driver: StorageDriver = getStorageDriver()): Promise<StoredKycFile[]> {
  const stored: StoredKycFile[] = [];
  try {
    for (const file of files) {
      const storageKey = generateStorageKey("kyc");
      await driver.put(storageKey, file.data, { contentType: file.mimeType });
      const { data: _data, ...meta } = file;
      void _data;
      stored.push({ ...meta, storageDriver: driver.name, storageKey });
    }
    return stored;
  } catch (error) {
    await discardKycFiles(stored, driver);
    throw error;
  }
}

export async function discardKycFiles(stored: Array<{ storageKey: string; storageDriver: string }>, driver?: StorageDriver) {
  for (const file of stored) {
    try {
      await (driver ?? getStorageDriver(file.storageDriver)).delete(file.storageKey);
    } catch {
      // Orphan file at worst; never mask the original error.
    }
  }
}
