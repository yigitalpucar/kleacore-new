import type { NextRequest } from "next/server";
import { getAppBaseUrl } from "@/lib/stripe";
import type { AttachmentInput } from "./attachments";

/**
 * Cookie-authenticated POST routes (multipart uploads) are not covered by the
 * Server Action origin check, so they require a same-origin Origin header.
 */
export function isSameOriginRequest(request: Pick<NextRequest, "headers" | "nextUrl">) {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  const allowed = new Set([request.nextUrl.origin]);
  try {
    allowed.add(new URL(getAppBaseUrl()).origin);
  } catch {
    // APP_URL unset or malformed: only the request origin counts.
  }
  return allowed.has(origin);
}

export class BodyTooLargeError extends Error {
  constructor() {
    super("BODY_TOO_LARGE");
  }
}

/**
 * Reads a multipart body with a hard byte cap (Content-Length is checked up
 * front, the stream is counted for chunked uploads) and parses it.
 */
export async function readMultipartForm(request: Request, maxBytes: number): Promise<FormData> {
  const declared = Number(request.headers.get("content-length") ?? "");
  if (Number.isFinite(declared) && declared > maxBytes) throw new BodyTooLargeError();

  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().startsWith("multipart/form-data")) throw new Error("NOT_MULTIPART");
  if (!request.body) return new FormData();

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel().catch(() => {});
      throw new BodyTooLargeError();
    }
    chunks.push(value);
  }
  return new Response(Buffer.concat(chunks), { headers: { "content-type": contentType } }).formData();
}

export function formText(form: FormData, key: string) {
  const value = form.get(key);
  return typeof value === "string" ? value : "";
}

/** Non-empty File entries of a field, read into memory (limits were enforced by readMultipartForm). */
export async function formFiles(form: FormData, key = "files"): Promise<AttachmentInput[]> {
  const files: AttachmentInput[] = [];
  for (const entry of form.getAll(key)) {
    if (typeof entry === "string" || entry.size === 0) continue;
    files.push({ name: entry.name, data: Buffer.from(await entry.arrayBuffer()) });
  }
  return files;
}
