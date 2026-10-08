import { createLogger } from "@/lib/logger";
import type { EventSubscriber } from "./types";
import { isEvent } from "./types";

const log = createLogger("events.einvoice");

/**
 * invoice.paid → official e-invoice (Uyumsoft / Paraşüt). Queues the existing
 * efatura.issue job (exclusive per invoice, own retry policy and admin record);
 * issueEInvoiceForInvoice is idempotent per invoice (one record, stable ETTN),
 * so a repeated delivery never issues twice. With the queue down it issues inline.
 */
export const einvoiceSubscriber: EventSubscriber = {
  name: "einvoice",
  label: "E-fatura",
  handles: (type) => type === "invoice.paid",
  async handle(event) {
    if (!isEvent(event, "invoice.paid")) return { skipped: "UNSUPPORTED_EVENT" };
    const invoiceId = event.payload.invoiceId;

    try {
      const { enqueue } = await import("@/lib/jobs/enqueue");
      const { EFATURA_ISSUE_JOB } = await import("@/lib/jobs/definitions");
      const result = await enqueue(EFATURA_ISSUE_JOB, { invoiceId }, { singletonKey: invoiceId });
      return { queued: !result.deduplicated, jobId: result.id };
    } catch (error) {
      log.warn("efatura.issue could not be queued; issuing inline", { invoiceId, error });
    }

    const { runEInvoiceIssueJob } = await import("@/lib/payments/follow-ups");
    return { inline: await runEInvoiceIssueJob(invoiceId) };
  },
};
