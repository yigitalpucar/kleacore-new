import { db } from "@/lib/db";
import type { GriRegistrarConfig } from "../types";

const TOKEN_SETTING_KEY = "registrar_gri_oauth_token";
const REQUEST_TIMEOUT_MS = 15000;

export const GRI_API_URL_SANDBOX = "https://b2b-api-test.gri.net";
export const GRI_API_URL_PROD = "https://b2b-prod-api.gri.net";

interface GriOAuthToken {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  created_at: number;
  token_type?: string;
}

interface GriApiErrorBody {
  status?: boolean;
  message?: string;
  detail?: string;
  error?: string;
  error_description?: string;
}

export class GriApiError extends Error {
  constructor(
    message: string,
    readonly code = "GRI_API_ERROR"
  ) {
    super(message);
    this.name = "GriApiError";
  }
}

function resolveBaseUrl(config: GriRegistrarConfig) {
  if (config.apiUrl?.trim()) {
    return config.apiUrl.replace(/\/$/, "");
  }
  return config.testMode ? GRI_API_URL_SANDBOX : GRI_API_URL_PROD;
}

function buildQuery(params: Record<string, string | number | undefined>) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") {
      search.set(key, String(value));
    }
  }
  const query = search.toString();
  return query ? `?${query}` : "";
}

async function readToken(): Promise<GriOAuthToken | null> {
  const row = await db.setting.findUnique({
    where: { key: TOKEN_SETTING_KEY },
    select: { value: true },
  });
  if (!row?.value) return null;
  try {
    return JSON.parse(row.value) as GriOAuthToken;
  } catch {
    return null;
  }
}

async function writeToken(token: GriOAuthToken) {
  await db.setting.upsert({
    where: { key: TOKEN_SETTING_KEY },
    create: {
      key: TOKEN_SETTING_KEY,
      value: JSON.stringify(token),
      group: "integrations",
      type: "json",
      label: "Gri OAuth Token",
    },
    update: { value: JSON.stringify(token) },
  });
}

async function clearToken() {
  await db.setting.deleteMany({ where: { key: TOKEN_SETTING_KEY } });
}

function isTokenValid(token: GriOAuthToken) {
  if (!token.access_token || !token.created_at || !token.expires_in) return false;
  return token.created_at + token.expires_in > Math.floor(Date.now() / 1000) + 30;
}

function extractErrorMessage(payload: GriApiErrorBody | string | null | undefined) {
  if (!payload) return "GRI_UNKNOWN_ERROR";
  if (typeof payload === "string") return payload;
  return (
    payload.detail ||
    payload.message ||
    payload.error_description ||
    payload.error ||
    "GRI_UNKNOWN_ERROR"
  );
}

async function parseResponse<T>(response: Response): Promise<T> {
  const text = await response.text();
  if (!text) {
    if (!response.ok) {
      throw new GriApiError(`HTTP_${response.status}`);
    }
    return {} as T;
  }

  let payload: T & GriApiErrorBody;
  try {
    payload = JSON.parse(text) as T & GriApiErrorBody;
  } catch {
    if (!response.ok) {
      throw new GriApiError(`HTTP_${response.status}`);
    }
    return text as T;
  }

  if (!response.ok) {
    throw new GriApiError(extractErrorMessage(payload), `HTTP_${response.status}`);
  }

  if (payload && typeof payload === "object" && payload.status === false) {
    throw new GriApiError(extractErrorMessage(payload));
  }

  return payload;
}

export class GriClient {
  private readonly baseUrl: string;

  constructor(private readonly config: GriRegistrarConfig) {
    this.baseUrl = resolveBaseUrl(config);
  }

  private assertCredentials() {
    if (
      !this.config.username ||
      !this.config.password ||
      !this.config.clientId ||
      !this.config.clientSecret
    ) {
      throw new GriApiError("GRI_CREDENTIALS_MISSING");
    }
  }

  async request<T>(
    path: string,
    options: {
      method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
      body?: unknown;
      query?: Record<string, string | number | undefined>;
      auth?: boolean;
    } = {}
  ): Promise<T> {
    const method = options.method ?? (options.body ? "POST" : "GET");
    const auth = options.auth !== false;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const headers: Record<string, string> = {
        accept: "application/json",
      };

      if (auth) {
        const token = await this.getAccessToken();
        headers.authorization = `Bearer ${token}`;
      }

      let url = `${this.baseUrl}${path}`;
      if (options.query && Object.keys(options.query).length > 0) {
        url += buildQuery(options.query);
      }

      if (options.body !== undefined && method !== "GET") {
        headers["content-type"] = "application/json";
      }

      const response = await fetch(url, {
        method,
        headers,
        body:
          options.body !== undefined && method !== "GET"
            ? JSON.stringify(options.body)
            : undefined,
        signal: controller.signal,
      });

      return await parseResponse<T>(response);
    } catch (error) {
      if (error instanceof GriApiError) throw error;
      if (error instanceof Error && error.name === "AbortError") {
        throw new GriApiError("GRI_REQUEST_TIMEOUT");
      }
      throw new GriApiError(error instanceof Error ? error.message : "GRI_REQUEST_FAILED");
    } finally {
      clearTimeout(timeout);
    }
  }

  private async fetchToken(
    params: Record<string, string | number | undefined>
  ): Promise<GriOAuthToken> {
    const url = `${this.baseUrl}/oauth/v2/token${buildQuery(params)}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const response = await fetch(url, { method: "GET", signal: controller.signal });
      const payload = await parseResponse<GriOAuthToken & GriApiErrorBody>(response);

      if (!payload.access_token) {
        throw new GriApiError(extractErrorMessage(payload), "GRI_TOKEN_FAILED");
      }

      return {
        access_token: payload.access_token,
        refresh_token: payload.refresh_token,
        expires_in: payload.expires_in ?? 3600,
        created_at: Math.floor(Date.now() / 1000),
        token_type: payload.token_type,
      };
    } finally {
      clearTimeout(timeout);
    }
  }

  async getAccessToken(forceNew = false): Promise<string> {
    this.assertCredentials();

    if (!forceNew) {
      const cached = await readToken();
      if (cached && isTokenValid(cached)) {
        return cached.access_token;
      }

      if (cached?.refresh_token) {
        try {
          const refreshed = await this.fetchToken({
            grant_type: "refresh_token",
            refresh_token: cached.refresh_token,
            client_id: this.config.clientId,
            client_secret: this.config.clientSecret,
          });
          await writeToken(refreshed);
          return refreshed.access_token;
        } catch {
          // fall through to password grant
        }
      }
    }

    const token = await this.fetchToken({
      grant_type: "password",
      username: this.config.username,
      password: this.config.password,
      client_id: this.config.clientId,
      client_secret: this.config.clientSecret,
    });

    await writeToken(token);
    return token.access_token;
  }

  async testConnection() {
    await clearToken();
    await this.getAccessToken(true);
    return true;
  }
}

export function mapGriAvailability(detail: string | undefined) {
  const normalized = (detail ?? "").toLowerCase();
  return normalized === "available";
}