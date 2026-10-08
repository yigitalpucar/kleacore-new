import { createLogger } from "@/lib/logger";

const log = createLogger("efatura.parasut");

export interface ParasutCredentials {
  clientId: string;
  clientSecret: string;
  username: string;
  password: string;
  companyId: string;
}

export function parseParasutCredentials(raw: string): ParasutCredentials | null {
  const trimmed = raw.trim();
  if (!trimmed) {
    return null;
  }

  if (trimmed.startsWith("{")) {
    try {
      const parsed = JSON.parse(trimmed) as Partial<ParasutCredentials>;
      if (
        parsed.clientId &&
        parsed.clientSecret &&
        parsed.username &&
        parsed.password &&
        parsed.companyId
      ) {
        return {
          clientId: parsed.clientId.trim(),
          clientSecret: parsed.clientSecret.trim(),
          username: parsed.username.trim(),
          password: parsed.password.trim(),
          companyId: parsed.companyId.trim(),
        };
      }
      return null;
    } catch {
      // Don't log the parse error: its message quotes the (secret) input.
      log.error("stored Paraşüt credentials are not valid JSON; e-invoices cannot be sent");
      return null;
    }
  }

  const parts = trimmed.split(":");
  if (parts.length !== 5) {
    return null;
  }

  const [clientId, clientSecret, username, password, companyId] = parts;
  if (!clientId || !clientSecret || !username || !password || !companyId) {
    return null;
  }

  return {
    clientId: clientId.trim(),
    clientSecret: clientSecret.trim(),
    username: username.trim(),
    password: password.trim(),
    companyId: companyId.trim(),
  };
}