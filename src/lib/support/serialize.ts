import { legacyAttachmentNames } from "./attachments";

/** Thread message for the ticket pages (plain JSON for client components). */
export function serializeThreadMessage(message: {
  id: string;
  senderId: string;
  senderName: string;
  senderRole: string;
  message: string;
  source: string;
  attachments: unknown;
  files: { id: string; fileName: string; mimeType: string; sizeBytes: number }[];
  createdAt: Date;
}) {
  return {
    id: message.id,
    senderId: message.senderId,
    senderName: message.senderName,
    senderRole: message.senderRole,
    message: message.message,
    source: message.source,
    files: message.files,
    legacyAttachments: legacyAttachmentNames(message.attachments),
    createdAt: message.createdAt.toISOString(),
  };
}

export type ThreadMessage = ReturnType<typeof serializeThreadMessage>;
