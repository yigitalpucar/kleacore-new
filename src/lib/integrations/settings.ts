import { db } from "@/lib/db";
import { resolveSettingValue } from "@/lib/secrets/crypto";

export type IntegrationResult<T = unknown> = {
  ok: boolean;
  skipped?: boolean;
  provider?: string;
  reference?: string;
  data?: T;
  error?: string;
};

export function isEnabled(value: string | undefined | null) {
  return ["1", "true", "yes", "on", "active"].includes((value ?? "").toLowerCase());
}

export async function getSettingValue(key: string, envName?: string, fallback = "") {
  const setting = await db.setting.findUnique({
    where: { key },
    select: { value: true },
  });

  const rawValue =
    setting?.value || (envName ? process.env[envName] : undefined) || fallback;

  return resolveSettingValue(key, rawValue);
}

export async function getSettingMap(
  keys: Array<{ key: string; env?: string; fallback?: string }>
) {
  const settings = await db.setting.findMany({
    where: { key: { in: keys.map((item) => item.key) } },
    select: { key: true, value: true },
  });
  const map = new Map(settings.map((setting) => [setting.key, setting.value]));

  return Object.fromEntries(
    keys.map((item) => {
      const rawValue =
        map.get(item.key) ||
        (item.env ? process.env[item.env] : undefined) ||
        item.fallback ||
        "";

      return [item.key, resolveSettingValue(item.key, rawValue)];
    })
  );
}

export async function postIntegrationJson<T = unknown>(
  baseUrl: string,
  path: string,
  apiKey: string,
  body: unknown
): Promise<IntegrationResult<T>> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  const url = `${baseUrl.replace(/\/$/, "")}${path}`;

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(apiKey ? { authorization: `Bearer ${apiKey}` } : {}),
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const text = await response.text();
    const payload = text ? (JSON.parse(text) as T) : undefined;

    if (!response.ok) {
      return {
        ok: false,
        error: `HTTP_${response.status}`,
        data: payload,
      };
    }

    return { ok: true, data: payload };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "INTEGRATION_REQUEST_FAILED",
    };
  } finally {
    clearTimeout(timeout);
  }
}
