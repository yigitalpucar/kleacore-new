import type { PaymentMethod } from "@prisma/client";

/** Müşterinin sipariş/fatura ödemesinde seçebileceği yöntemler */
export const CUSTOMER_PAYMENT_METHODS = ["CREDIT_CARD", "BANK_TRANSFER"] as const;

export type CustomerPaymentMethod = (typeof CUSTOMER_PAYMENT_METHODS)[number];

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  CREDIT_CARD: "Kredi Kartı",
  BANK_TRANSFER: "Banka Havalesi",
  BALANCE: "Bakiye",
};

export const CUSTOMER_PAYMENT_METHOD_OPTIONS: Array<{
  value: CustomerPaymentMethod;
  label: string;
  description: string;
}> = [
  {
    value: "CREDIT_CARD",
    label: "Kredi Kartı",
    description: "Visa, Mastercard, Troy ile anında ödeme",
  },
  {
    value: "BANK_TRANSFER",
    label: "Banka Havalesi",
    description: "Havale/EFT sonrası manuel onay",
  },
];

export function isCustomerPaymentMethod(
  value: string
): value is CustomerPaymentMethod {
  return CUSTOMER_PAYMENT_METHODS.includes(value as CustomerPaymentMethod);
}