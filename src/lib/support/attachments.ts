import { createHash } from "node:crypto";
import { generateStorageKey, getStorageDriver, type StorageDriver } from "@/lib/storage";
import { sniffFile, type SniffedKind } from "@/lib/storage/sniff";

/** Per-file and per-message limits for ticket attachments (web form and e-mail). */
export const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;
export const MAX_ATTACHMENTS = 5;
/** Upper bound for a whole multipart request: all files + form fields + multipart overhead. */
export const MAX_UPLOAD_REQUEST_BYTES = MAX_ATTACHMENTS * MAX_ATTACHMENT_BYTES + 1024 * 1024;

/** `accept` attribute for the file inputs (a hint only; the server sniffs content). */
export const ATTACHMENT_ACCEPT =
  ".png,.jpg,.jpeg,.gif,.webp,.pdf,.txt,.log,.csv,.zip,.rar,.7z,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.odt,.ods,.odp,.svg";
export const ATTACHMENT_HINT = `PNG, JPG, PDF, TXT, ZIP, Office belgeleri · dosya başına en fazla 10 MB, en fazla ${MAX_ATTACHMENTS} dosya`;

/** Allowed extensions (lowercase) → MIME type served, per detected content kind. */
const KIND_EXTENSIONS: Record<SniffedKind, Record<string, string>> = {
  png: { png: "image/png" },
  jpeg: { jpg: "image/jpeg", jpeg: "image/jpeg", jfif: "image/jpeg" },
  gif: { gif: "image/gif" },
  webp: { webp: "image/webp" },
  pdf: { pdf: "application/pdf" },
  zip: { zip: "application/zip" },
  ooxml: {
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  },
  odf: {
    odt: "application/vnd.oasis.opendocument.text",
    ods: "application/vnd.oasis.opendocument.spreadsheet",
    odp: "application/vnd.oasis.opendocument.presentation",
  },
  ole: { doc: "application/msword", xls: "application/vnd.ms-excel", ppt: "application/vnd.ms-powerpoint" },
  rar: { rar: "application/vnd.rar" },
  "7z": { "7z": "application/x-7z-compressed" },
  svg: { svg: "image/svg+xml" },
  text: { txt: "text/plain", log: "text/plain", csv: "text/csv" },
};

const REJECT_MESSAGES = {
  EXECUTABLE: "çalıştırılabilir dosyalar kabul edilmiyor",
  SCRIPT: "betik (script) dosyaları kabul edilmiyor",
  UNSAFE_SVG: "betik veya dış bağlantı içeren SVG kabul edilmiyor",
  HTML: "HTML dosyaları kabul edilmiyor",
  MACRO: "makro içeren Office belgeleri kabul edilmiyor",
  UNKNOWN: "izin verilmeyen dosya türü",
  EMPTY: "dosya boş",
} as const;

export interface AttachmentInput {
  name: string;
  data: Buffer;
}

export interface ValidAttachment {
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  sha256: string;
  data: Buffer;
}

export type AttachmentValidation =
  | ({ ok: true } & ValidAttachment)
  | { ok: false; fileName: string; error: string };

/**
 * Display name only: path parts, control / bidi characters and quotes are
 * removed and the length capped. It is never used to build a path or key.
 */
export function sanitizeFileName(name: string): string {
  const base = name.normalize("NFC").split(/[\\/]/).pop() ?? "";
  const cleaned = base
    .replace(/[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u202a-\u202e\u2066-\u2069"<>|:*?]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^\.+/, "");
  if (!cleaned) return "dosya";
  if (cleaned.length <= 180) return cleaned;
  const dot = cleaned.lastIndexOf(".");
  const ext = dot > 0 && cleaned.length - dot <= 10 ? cleaned.slice(dot) : "";
  return cleaned.slice(0, 180 - ext.length) + ext;
}

function extensionOf(fileName: string) {
  const dot = fileName.lastIndexOf(".");
  return dot > 0 ? fileName.slice(dot + 1).toLowerCase() : "";
}

export function validateAttachment(input: AttachmentInput): AttachmentValidation {
  const fileName = sanitizeFileName(input.name);
  const fail = (error: string): AttachmentValidation => ({ ok: false, fileName, error: `${fileName}: ${error}` });

  if (input.data.length > MAX_ATTACHMENT_BYTES) return fail("10 MB sınırını aşıyor");

  const sniffed = sniffFile(input.data);
  if (!sniffed.ok) return fail(REJECT_MESSAGES[sniffed.reason]);

  const extension = extensionOf(fileName);
  const mimeType = KIND_EXTENSIONS[sniffed.kind][extension];
  if (!mimeType) {
    return fail(extension ? "dosya uzantısı içerikle uyuşmuyor veya izin verilmiyor" : "dosya uzantısı yok");
  }

  return {
    ok: true,
    fileName,
    mimeType,
    sizeBytes: input.data.length,
    sha256: createHash("sha256").update(input.data).digest("hex"),
    data: input.data,
  };
}

/** Validates a set of files for one message; the first problem wins (all-or-nothing for web forms). */
export function validateAttachments(
  inputs: AttachmentInput[]
): { ok: true; files: ValidAttachment[] } | { ok: false; error: string } {
  if (inputs.length > MAX_ATTACHMENTS) return { ok: false, error: `En fazla ${MAX_ATTACHMENTS} dosya ekleyebilirsiniz.` };
  const files: ValidAttachment[] = [];
  for (const input of inputs) {
    const result = validateAttachment(input);
    if (!result.ok) return { ok: false, error: result.error };
    files.push(result);
  }
  return { ok: true, files };
}

export interface StoredAttachment {
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  sha256: string;
  storageDriver: string;
  storageKey: string;
}

/** Writes validated files under fresh random keys. On a failure, already written files are removed. */
export async function storeAttachments(
  files: ValidAttachment[],
  driver: StorageDriver = getStorageDriver()
): Promise<StoredAttachment[]> {
  const stored: StoredAttachment[] = [];
  try {
    for (const file of files) {
      const storageKey = generateStorageKey("tickets");
      await driver.put(storageKey, file.data, { contentType: file.mimeType });
      stored.push({
        fileName: file.fileName,
        mimeType: file.mimeType,
        sizeBytes: file.sizeBytes,
        sha256: file.sha256,
        storageDriver: driver.name,
        storageKey,
      });
    }
    return stored;
  } catch (error) {
    await discardStoredAttachments(stored, driver);
    throw error;
  }
}

/** Best-effort cleanup when the DB write that should reference the files failed. */
export async function discardStoredAttachments(stored: StoredAttachment[], driver?: StorageDriver) {
  for (const file of stored) {
    try {
      await (driver ?? getStorageDriver(file.storageDriver)).delete(file.storageKey);
    } catch {
      // Orphan file at worst; never mask the original error.
    }
  }
}

/** RFC 6266 attachment header with an ASCII fallback and the UTF-8 name. */
export function contentDisposition(fileName: string) {
  const fallback = fileName.replace(/[^\x20-\x7e]/g, "_").replace(/["\;]/g, "_") || "dosya";
  const encoded = encodeURIComponent(fileName).replace(/['()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
  return `attachment; filename="${fallback}"; filename*=UTF-8''${encoded}`;
}

/** Legacy TicketMessage.attachments JSON (names only) → display rows. */
export function legacyAttachmentNames(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => (item && typeof item === "object" ? (item as Record<string, unknown>).name : null))
    .filter((name): name is string => typeof name === "string" && name.length > 0)
    .map(sanitizeFileName);
}
