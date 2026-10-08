/**
 * Legacy outbound webhook contract (settings webhook_orders / webhook_payments).
 * External receivers depend on these three types and payload shapes, so the
 * outbox "webhooks" subscriber maps the new catalogue events onto them
 * (invoice.paid → payment.completed, order.paid, service.renewed).
 */
export type PaymentCompletedContext = "invoice" | "order" | "renewal";

export type PaymentCompletedPayload = {
  invoiceId: string;
  invoiceNumber: string;
  customerId: string;
  amount: number;
  paymentReference?: string;
  context: PaymentCompletedContext;
};

export type OrderPaidPayload = {
  orderId: string;
  orderNumber: string;
  customerId: string;
  totalAmount: number;
};

export type ServiceRenewedPayload = {
  serviceId: string;
  customerId: string;
  newExpiryDate: string;
  renewalMonths: number;
};

export type KleacoreEventType = "payment.completed" | "order.paid" | "service.renewed";

export type KleacoreEvent =
  | { type: "payment.completed"; payload: PaymentCompletedPayload }
  | { type: "order.paid"; payload: OrderPaidPayload }
  | { type: "service.renewed"; payload: ServiceRenewedPayload };

export type KleacoreEventPayload<T extends KleacoreEventType> = Extract<
  KleacoreEvent,
  { type: T }
>["payload"];
