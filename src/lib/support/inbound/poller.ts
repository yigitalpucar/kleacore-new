import { ImapFlow } from "imapflow";
import type { SupportMailbox } from "@prisma/client";
import { db } from "@/lib/db";
import { createLogger } from "@/lib/logger";
import { decryptSecret } from "@/lib/secrets/crypto";
import { parseRawEmail } from "./mail";
import { processInboundEmail, type InboundOutcome } from "./process";

const log = createLogger("support.imap");

/** Per poll and mailbox; the rest waits for the next run (cron every 2 minutes). */
export const MAX_MESSAGES_PER_POLL = 50;
/** Bigger messages are not downloaded (5 × 10 MB attachments + base64 overhead). */
export const MAX_RAW_MESSAGE_BYTES = 75 * 1024 * 1024;

export interface MailboxPollSummary {
  mailboxId: string;
  fetched: number;
  created: number;
  replied: number;
  ignored: number;
  duplicates: number;
  failed: number;
  error?: string;
}

type ImapClient = Pick<
  ImapFlow,
  "connect" | "logout" | "getMailboxLock" | "search" | "fetchOne" | "messageFlagsAdd" | "messageMove" | "mailboxCreate" | "list"
>;

export type ImapClientFactory = (mailbox: SupportMailbox) => ImapClient;

export const defaultImapClientFactory: ImapClientFactory = (mailbox) =>
  new ImapFlow({
    host: mailbox.host,
    port: mailbox.port,
    secure: mailbox.secure,
    auth: { user: mailbox.username, pass: decryptSecret(mailbox.password) },
    logger: false,
    connectionTimeout: 20_000,
    greetingTimeout: 15_000,
    socketTimeout: 120_000,
    // STARTTLS is required on non-implicit-TLS ports, except on loopback test servers.
    doSTARTTLS: mailbox.secure ? undefined : !/^(127\.0\.0\.1|localhost|::1)$/.test(mailbox.host),
  });

/** Done (processed, ignored, duplicate, or failed for the last time) → mark the mail so it is not fetched again. */
function isFinal(outcome: InboundOutcome) {
  return outcome.status !== "FAILED" || outcome.final;
}

async function ensureFolder(client: ImapClient, folder: string) {
  const folders = await client.list();
  if (!folders.some((f) => f.path === folder)) await client.mailboxCreate(folder);
}

/**
 * One IMAP pass over a mailbox: every unseen message is parsed and turned
 * into a ticket / reply, then flagged \Seen (and moved to processedFolder
 * when configured). Fetching uses BODY.PEEK, so a crash leaves the mail
 * unread and the Message-ID dedupe makes the retry idempotent.
 */
export async function pollMailbox(
  mailbox: SupportMailbox,
  clientFactory: ImapClientFactory = defaultImapClientFactory
): Promise<MailboxPollSummary> {
  const summary: MailboxPollSummary = {
    mailboxId: mailbox.id,
    fetched: 0,
    created: 0,
    replied: 0,
    ignored: 0,
    duplicates: 0,
    failed: 0,
  };
  const client = clientFactory(mailbox);
  await client.connect();
  try {
    if (mailbox.processedFolder) await ensureFolder(client, mailbox.processedFolder);
    const lock = await client.getMailboxLock(mailbox.folder || "INBOX");
    try {
      const found = await client.search({ seen: false }, { uid: true });
      const uids = (found || []).slice(0, MAX_MESSAGES_PER_POLL);
      for (const uid of uids) {
        const fetched = await client.fetchOne(String(uid), { source: true, size: true }, { uid: true });
        if (!fetched || !fetched.source) continue;
        summary.fetched++;

        let outcome: InboundOutcome;
        if ((fetched.size ?? fetched.source.length) > MAX_RAW_MESSAGE_BYTES) {
          outcome = { status: "FAILED", error: "MESSAGE_TOO_LARGE", final: true };
          log.warn("inbound mail too large", { mailboxId: mailbox.id, uid, size: fetched.size });
        } else {
          try {
            outcome = await processInboundEmail(await parseRawEmail(fetched.source), mailbox);
          } catch (error) {
            // Parse / DB outage: leave unread for the next poll.
            log.error("inbound mail processing threw", { mailboxId: mailbox.id, uid, error });
            outcome = { status: "FAILED", error: error instanceof Error ? error.message : String(error), final: false };
          }
        }

        if (outcome.status === "CREATED") summary.created++;
        else if (outcome.status === "REPLIED") summary.replied++;
        else if (outcome.status === "IGNORED") summary.ignored++;
        else if (outcome.status === "DUPLICATE") summary.duplicates++;
        else summary.failed++;

        if (isFinal(outcome)) {
          await client.messageFlagsAdd(String(uid), ["\\Seen"], { uid: true });
          if (mailbox.processedFolder) await client.messageMove(String(uid), mailbox.processedFolder, { uid: true });
        }
      }
    } finally {
      lock.release();
    }
  } finally {
    await client.logout().catch(() => {});
  }
  return summary;
}

/** Cron body (`support-mail`): polls every active mailbox; one broken mailbox does not stop the others. */
export async function pollSupportMailboxes(clientFactory?: ImapClientFactory) {
  const mailboxes = await db.supportMailbox.findMany({ where: { isActive: true }, orderBy: { createdAt: "asc" } });
  const results: MailboxPollSummary[] = [];
  for (const mailbox of mailboxes) {
    try {
      const summary = await pollMailbox(mailbox, clientFactory);
      results.push(summary);
      await db.supportMailbox.update({ where: { id: mailbox.id }, data: { lastPolledAt: new Date(), lastError: null } });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      log.error("mailbox poll failed", { mailboxId: mailbox.id, error: message });
      results.push({ mailboxId: mailbox.id, fetched: 0, created: 0, replied: 0, ignored: 0, duplicates: 0, failed: 0, error: message });
      await db.supportMailbox
        .update({ where: { id: mailbox.id }, data: { lastPolledAt: new Date(), lastError: message.slice(0, 500) } })
        .catch(() => {});
    }
  }
  const total = (key: "created" | "replied" | "ignored" | "failed") => results.reduce((sum, r) => sum + r[key], 0);
  return {
    processed: total("created") + total("replied"),
    mailboxes: results.length,
    created: total("created"),
    replied: total("replied"),
    ignored: total("ignored"),
    failed: total("failed"),
    errors: results.filter((r) => r.error).length,
  };
}

/** "Bağlantıyı test et" on the settings screen: login + open the folder, nothing is read or changed. */
export async function testMailboxConnection(mailbox: SupportMailbox, clientFactory: ImapClientFactory = defaultImapClientFactory) {
  const client = clientFactory(mailbox);
  await client.connect();
  try {
    const lock = await client.getMailboxLock(mailbox.folder || "INBOX");
    try {
      const unseen = await client.search({ seen: false }, { uid: true });
      return { unseen: (unseen || []).length };
    } finally {
      lock.release();
    }
  } finally {
    await client.logout().catch(() => {});
  }
}
