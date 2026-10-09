/**
 * Every admin API operation. The OpenAPI document, the docs page and the
 * permission coverage test read this list; each entry is served by the
 * route file at src/app/api/admin/v1/<path>/route.ts.
 */
import type { AnyOperation } from "./operation";
import * as customers from "./operations/customers";
import * as domains from "./operations/domains";
import * as events from "./operations/events";
import * as invoices from "./operations/invoices";
import * as jobs from "./operations/jobs";
import * as meta from "./operations/meta";
import * as orders from "./operations/orders";
import * as reports from "./operations/reports";
import * as services from "./operations/services";
import * as tickets from "./operations/tickets";

export const ADMIN_API_OPERATIONS: AnyOperation[] = [
  meta.getMe,
  meta.getOpenApi,
  customers.listCustomers,
  customers.createCustomer,
  customers.getCustomer,
  customers.updateCustomer,
  services.listServices,
  services.getService,
  services.suspendService,
  services.unsuspendService,
  services.terminateService,
  services.retryServiceProvisioning,
  invoices.listInvoices,
  invoices.createInvoice,
  invoices.getInvoice,
  invoices.markInvoicePaid,
  invoices.sendInvoiceReminder,
  orders.listOrders,
  orders.getOrder,
  orders.approveOrder,
  orders.approveOrderReview,
  tickets.listTickets,
  tickets.getTicket,
  tickets.replyToTicket,
  tickets.closeTicket,
  domains.listDomains,
  domains.getDomain,
  domains.syncDomain,
  domains.renewDomain,
  events.listEvents,
  jobs.listFailedJobs,
  jobs.retryJob,
  reports.mrrReport,
  reports.receivablesReport,
];
