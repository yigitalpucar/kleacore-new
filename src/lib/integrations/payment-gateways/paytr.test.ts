import { createHmac } from "crypto";
import { describe, expect, it } from "vitest";
import { buildPaytrCallbackHash, buildPaytrToken } from "./paytr-hash";

describe("buildPaytrToken", () => {
  it("generates base64 HMAC-SHA256 paytr_token for get-token API", () => {
    const merchantId = "123456";
    const userIp = "127.0.0.1";
    const merchantOid = "KL1234567890abcdef";
    const email = "musteri@example.com";
    const paymentAmount = 3456;
    const userBasket = Buffer.from(
      JSON.stringify([["KLEACORE Ödeme", "34.56", 1]]),
      "utf8"
    ).toString("base64");
    const noInstallment = "0";
    const maxInstallment = "0";
    const currency = "TL";
    const testMode = "1";
    const merchantSalt = "merchant-salt";
    const merchantKey = "merchant-key";

    const hashStr = `${merchantId}${userIp}${merchantOid}${email}${paymentAmount}${userBasket}${noInstallment}${maxInstallment}${currency}${testMode}${merchantSalt}`;
    const expected = createHmac("sha256", merchantKey).update(hashStr, "utf8").digest("base64");

    expect(
      buildPaytrToken(
        merchantId,
        userIp,
        merchantOid,
        email,
        paymentAmount,
        userBasket,
        noInstallment,
        maxInstallment,
        currency,
        testMode,
        merchantSalt,
        merchantKey
      )
    ).toBe(expected);
  });
});

describe("buildPaytrCallbackHash", () => {
  it("generates callback hash for PayTR notification verification", () => {
    const merchantOid = "KL1234567890abcdef";
    const merchantSalt = "merchant-salt";
    const status = "success";
    const totalAmount = "3456";
    const merchantKey = "merchant-key";

    const hashStr = `${merchantOid}${merchantSalt}${status}${totalAmount}`;
    const expected = createHmac("sha256", merchantKey).update(hashStr, "utf8").digest("base64");

    expect(
      buildPaytrCallbackHash(merchantOid, merchantSalt, status, totalAmount, merchantKey)
    ).toBe(expected);
  });
});