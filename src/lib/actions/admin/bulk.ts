"use server";

/**
 * Bulk versions of existing single-item admin actions (UI3 item 11). Each
 * one requires the same permission as its single action and then calls that
 * action for every id (which checks the permission again and keeps all of
 * its own validation, events and revalidation). Results report partial
 * failures per id; see src/lib/admin/bulk.ts.
 */
import { runBulk, type BulkResult } from "@/lib/admin/bulk";
import { requirePermission } from "@/lib/utils/auth-helpers";
import { cancelInvoice, sendInvoiceReminder } from "./invoices";
import { activateService, suspendService } from "./services";
import { activateCustomer, suspendCustomer } from "./customers";
import { cancelOrder } from "./orders";
import { assignTicket, closeTicket } from "./tickets";

const REASON_MAX = 500;

function cleanReason(reason: unknown): string | null {
  if (typeof reason !== "string") return null;
  const trimmed = reason.trim().slice(0, REASON_MAX);
  return trimmed || null;
}

const missingReason = (): BulkResult => ({ success: false, total: 0, succeeded: 0, failed: [], error: "Neden girilmedi" });

export async function bulkSendInvoiceReminders(ids: string[]): Promise<BulkResult> {
  const session = await requirePermission("invoices.edit");
  return runBulk(ids, (id) => sendInvoiceReminder(id), {
    actorId: session.user.id,
    activity: { action: "invoice.reminder_sent", entity: "Invoice" },
  });
}

export async function bulkCancelInvoices(ids: string[]): Promise<BulkResult> {
  const session = await requirePermission("invoices.edit");
  return runBulk(ids, (id) => cancelInvoice(id), {
    actorId: session.user.id,
    activity: { action: "invoice.cancelled", entity: "Invoice" },
  });
}

/** Suspension already writes its own activity row (services/admin-lifecycle). */
export async function bulkSuspendServices(ids: string[], reason: string): Promise<BulkResult> {
  const session = await requirePermission("services.manage");
  const why = cleanReason(reason);
  if (!why) return missingReason();
  return runBulk(ids, (id) => suspendService(id, why), { actorId: session.user.id });
}

export async function bulkUnsuspendServices(ids: string[]): Promise<BulkResult> {
  const session = await requirePermission("services.manage");
  return runBulk(ids, (id) => activateService(id), { actorId: session.user.id });
}

export async function bulkSuspendCustomers(ids: string[]): Promise<BulkResult> {
  const session = await requirePermission("customers.edit");
  return runBulk(ids, (id) => suspendCustomer(id), {
    actorId: session.user.id,
    activity: { action: "customer.suspended", entity: "User" },
  });
}

export async function bulkActivateCustomers(ids: string[]): Promise<BulkResult> {
  const session = await requirePermission("customers.edit");
  return runBulk(ids, (id) => activateCustomer(id), {
    actorId: session.user.id,
    activity: { action: "customer.activated", entity: "User" },
  });
}

export async function bulkCancelOrders(ids: string[], reason: string): Promise<BulkResult> {
  const session = await requirePermission("orders.manage");
  const why = cleanReason(reason);
  if (!why) return missingReason();
  return runBulk(ids, (id) => cancelOrder(id, why), {
    actorId: session.user.id,
    activity: { action: "order.cancelled", entity: "Order", details: { reason: why } },
  });
}

export async function bulkAssignTickets(ids: string[], staffId: string): Promise<BulkResult> {
  const session = await requirePermission("tickets.reply");
  if (typeof staffId !== "string" || !staffId) {
    return { success: false, total: 0, succeeded: 0, failed: [], error: "Personel seçilmedi" };
  }
  return runBulk(ids, (id) => assignTicket(id, staffId), {
    actorId: session.user.id,
    activity: { action: "ticket.assigned", entity: "SupportTicket", details: { assignedTo: staffId } },
  });
}

export async function bulkCloseTickets(ids: string[]): Promise<BulkResult> {
  const session = await requirePermission("tickets.reply");
  return runBulk(ids, (id) => closeTicket(id), {
    actorId: session.user.id,
    activity: { action: "ticket.closed", entity: "SupportTicket" },
  });
}
