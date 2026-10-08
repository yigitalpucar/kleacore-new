/** A received e-mail, reduced to what ticket processing needs (independent of the parser library). */
export interface InboundMessage {
  /** Message-ID header (with angle brackets), or a stable synthetic id from the raw source hash. */
  messageId: string;
  from: { address: string; name: string | null };
  subject: string;
  /** Plain-text body (HTML-only mail already converted to text). */
  text: string;
  inReplyTo: string[];
  references: string[];
  /** Lowercase header name → raw value (first occurrence). */
  headers: Record<string, string>;
  /** Top-level content type, e.g. "multipart/report". */
  contentType: string | null;
  attachments: InboundAttachment[];
  receivedAt: Date;
}

export interface InboundAttachment {
  fileName: string;
  content: Buffer;
  /** Inline part referenced from the HTML (cid:) — signature logos etc., not kept. */
  related: boolean;
}
