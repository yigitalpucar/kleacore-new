import { db } from "@/lib/db";
import { getStorageDriver, isValidStorageKey } from "@/lib/storage";
import { canAccessTicket, type TicketViewer } from "./access";
import { contentDisposition } from "./attachments";

export type AttachmentDownload =
  | { ok: true; body: Buffer; headers: Record<string, string> }
  | { ok: false; status: 401 | 404 | 410 };

/**
 * Loads an attachment for a viewer: only the ticket's customer or support
 * staff; anyone else gets 404 (same as a missing id, so ids can't be probed).
 * Always served as a download, never rendered inline by the browser.
 */
export async function loadAttachmentForViewer(
  viewer: TicketViewer | null | undefined,
  attachmentId: string
): Promise<AttachmentDownload> {
  if (!viewer?.id) return { ok: false, status: 401 };
  if (!/^[a-z0-9]{10,40}$/i.test(attachmentId)) return { ok: false, status: 404 };

  const attachment = await db.ticketAttachment.findUnique({
    where: { id: attachmentId },
    select: {
      fileName: true,
      mimeType: true,
      sizeBytes: true,
      storageDriver: true,
      storageKey: true,
      ticket: { select: { customerId: true } },
    },
  });
  if (!attachment || !canAccessTicket(viewer, attachment.ticket)) return { ok: false, status: 404 };
  if (!isValidStorageKey(attachment.storageKey)) return { ok: false, status: 404 };

  const body = await getStorageDriver(attachment.storageDriver).get(attachment.storageKey);
  if (!body) return { ok: false, status: 410 };

  return {
    ok: true,
    body,
    headers: {
      "content-type": attachment.mimeType,
      "content-length": String(body.length),
      "content-disposition": contentDisposition(attachment.fileName),
      "x-content-type-options": "nosniff",
      "content-security-policy": "default-src 'none'; sandbox",
      "cross-origin-resource-policy": "same-origin",
      "cache-control": "private, no-store",
    },
  };
}
