import { createHmac } from "crypto";
import { describe, expect, it } from "vitest";
import { buildIyzicoAuthorization } from "./iyzico-auth";

describe("buildIyzicoAuthorization", () => {
  it("generates IYZWSv2 authorization header with HMAC-SHA256 signature", () => {
    const apiKey = "sandbox-api-key";
    const secretKey = "sandbox-secret-key";
    const uriPath = "/payment/bin/check";
    const requestBody = JSON.stringify({
      locale: "tr",
      binNumber: "535805",
      conversationId: "docsTest-v1",
    });
    const randomKey = "123456789";

    const payload = `${randomKey}${uriPath}${requestBody}`;
    const expectedSignature = createHmac("sha256", secretKey)
      .update(payload, "utf8")
      .digest("hex");
    const authorizationString = `apiKey:${apiKey}&randomKey:${randomKey}&signature:${expectedSignature}`;
    const expectedHeader = `IYZWSv2 ${Buffer.from(authorizationString, "utf8").toString("base64")}`;

    const result = buildIyzicoAuthorization(
      apiKey,
      secretKey,
      uriPath,
      requestBody,
      randomKey
    );

    expect(result.authorization).toBe(expectedHeader);
    expect(result.signature).toBe(expectedSignature);
  });
});