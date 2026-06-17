import { createHmac } from "crypto";

export function buildPaytrToken(
  merchantId: string,
  userIp: string,
  merchantOid: string,
  email: string,
  paymentAmount: string | number,
  userBasket: string,
  noInstallment: string | number,
  maxInstallment: string | number,
  currency: string,
  testMode: string | number,
  merchantSalt: string,
  merchantKey: string
) {
  const hashStr = `${merchantId}${userIp}${merchantOid}${email}${paymentAmount}${userBasket}${noInstallment}${maxInstallment}${currency}${testMode}${merchantSalt}`;
  return createHmac("sha256", merchantKey).update(hashStr, "utf8").digest("base64");
}

export function buildPaytrCallbackHash(
  merchantOid: string,
  merchantSalt: string,
  status: string,
  totalAmount: string,
  merchantKey: string
) {
  const hashStr = `${merchantOid}${merchantSalt}${status}${totalAmount}`;
  return createHmac("sha256", merchantKey).update(hashStr, "utf8").digest("base64");
}