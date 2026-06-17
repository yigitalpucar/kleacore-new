import { createHmac } from "crypto";

export function buildIyzicoAuthorization(
  apiKey: string,
  secretKey: string,
  uriPath: string,
  requestBody: string,
  randomKey: string
) {
  const payload = requestBody ? `${randomKey}${uriPath}${requestBody}` : `${randomKey}${uriPath}`;
  const signature = createHmac("sha256", secretKey).update(payload, "utf8").digest("hex");
  const authorizationString = `apiKey:${apiKey}&randomKey:${randomKey}&signature:${signature}`;
  const base64Encoded = Buffer.from(authorizationString, "utf8").toString("base64");

  return {
    authorization: `IYZWSv2 ${base64Encoded}`,
    randomKey,
    signature,
  };
}

export function createIyzicoRandomKey() {
  return `${Date.now()}${Math.floor(Math.random() * 1_000_000_000)}`;
}