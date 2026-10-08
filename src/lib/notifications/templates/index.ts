import type { z } from "zod";
import { accountInvite, authPasswordChanged, authPasswordReset, authVerifyEmail } from "./auth";
import {
  affiliatePayoutCompleted,
  billingBankTransferApproved,
  billingBankTransferRejected,
  billingInvoiceCreated,
  billingInvoiceOverdue,
  billingInvoiceReminder,
  billingOrderReceived,
  billingPaymentReceived,
  billingRefundIssued,
} from "./billing";
import { billingAutoChargeFailed, billingCardExpiring } from "./cards";
import { domainExpiryNotice, domainRegistered, domainRenewed } from "./domains";
import {
  serviceActivated,
  serviceCancellationApproved,
  serviceCancellationReceived,
  serviceSuspended,
  serviceUnsuspended,
  sslExpiryNotice,
} from "./services";
import {
  adminDomainRenewalFailed,
  adminManualProvisioning,
  adminTicketCustomerReply,
  supportTicketReplied,
} from "./support";
import type { NotificationTemplate } from "./types";

const definitions = [
  authVerifyEmail,
  authPasswordReset,
  authPasswordChanged,
  accountInvite,
  billingOrderReceived,
  billingPaymentReceived,
  billingInvoiceCreated,
  billingInvoiceReminder,
  billingInvoiceOverdue,
  billingBankTransferApproved,
  billingBankTransferRejected,
  billingRefundIssued,
  billingAutoChargeFailed,
  billingCardExpiring,
  affiliatePayoutCompleted,
  serviceActivated,
  serviceSuspended,
  serviceUnsuspended,
  serviceCancellationReceived,
  serviceCancellationApproved,
  sslExpiryNotice,
  domainRegistered,
  domainRenewed,
  domainExpiryNotice,
  supportTicketReplied,
  adminTicketCustomerReply,
  adminManualProvisioning,
  adminDomainRenewalFailed,
] as const;

export type RegisteredTemplate = (typeof definitions)[number];
export type TemplateKey = RegisteredTemplate["key"];
export type TemplateData<K extends TemplateKey> = Omit<
  z.input<Extract<RegisteredTemplate, { key: K }>["schema"]>,
  "recipientName"
> & { recipientName?: string };

const byKey = new Map<string, NotificationTemplate>();
for (const definition of definitions) {
  if (byKey.has(definition.key)) throw new Error(`Duplicate notification template "${definition.key}"`);
  byKey.set(definition.key, definition as unknown as NotificationTemplate);
}

export function getTemplate(key: string): NotificationTemplate {
  const template = byKey.get(key);
  if (!template) throw new Error(`Unknown notification template: ${key}`);
  return template;
}

export function hasTemplate(key: string): key is TemplateKey {
  return byKey.has(key);
}

export function listTemplates(): NotificationTemplate[] {
  return [...byKey.values()];
}

export type { EmailContent, NotificationBrand, NotificationTemplate, RenderContext } from "./types";
