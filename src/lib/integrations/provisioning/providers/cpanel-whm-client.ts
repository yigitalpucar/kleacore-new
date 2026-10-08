import type { CpanelWhmConfig } from "../types";

const REQUEST_TIMEOUT_MS = 15000;

interface WhmApiResponse {
  metadata?: {
    result?: number;
    reason?: string;
  };
  data?: Record<string, unknown>;
  status?: number;
  error?: string;
}

interface CpanelApiResponse {
  metadata?: {
    result?: number;
    reason?: string;
  };
  cpanelresult?: {
    event?: { result?: number };
    error?: string;
    errors?: string[];
    data?: unknown;
  };
  data?: unknown;
  error?: string;
}

export interface CpanelEmailAccount {
  email: string;
  domain?: string;
  user?: string;
  quota?: number | string;
  humandiskquota?: string;
  diskused?: number | string;
}

/** WHM `create_user_session` result. `url` carries a one-time session token: never log or store it. */
export interface WhmUserSession {
  url: string;
  /** Unix seconds. */
  expires?: number;
}

/** One row of WHM `listaccts` / `accountsummary` (the fields we read). */
export interface WhmAccountRow {
  user: string;
  domain?: string;
  email?: string;
  plan?: string;
  ip?: string;
  /** "102M", "1.5G" … */
  diskused?: string | number;
  /** "1000M" or "unlimited". */
  disklimit?: string | number;
  suspended?: number | string;
  unix_startdate?: number | string;
  suspendreason?: string;
  owner?: string;
}

/** listaccts row as read by importers (same shape as WhmAccountRow). */
export type WhmListAccount = WhmAccountRow;

/** One row of WHM `showbw` (current month). */
export interface WhmBandwidthRow {
  user: string;
  /** Bytes used this month. */
  totalbytes?: number | string;
  /** Bytes, 0 / "unlimited" = no limit. */
  limit?: number | string;
}

/** One row of WHM `listpkgs`. */
export interface WhmPackageRow {
  name: string;
  /** MB or "unlimited". */
  QUOTA?: string | number;
  /** MB or "unlimited". */
  BWLIMIT?: string | number;
}

export class CpanelWhmApiError extends Error {
  constructor(
    message: string,
    readonly code = "CPANEL_WHM_API_ERROR"
  ) {
    super(message);
    this.name = "CpanelWhmApiError";
  }
}

function buildBaseUrl(config: CpanelWhmConfig) {
  const protocol = config.useSsl ? "https" : "http";
  return `${protocol}://${config.host.replace(/\/+$/, "")}:${config.port}`;
}

function buildQuery(params: Record<string, string | number | undefined>) {
  const search = new URLSearchParams();
  search.set("api.version", "1");

  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") {
      search.set(key, String(value));
    }
  }

  return search.toString();
}

function parseCpanelApiData<T>(payload: CpanelApiResponse): T {
  const cpanelResult = payload.cpanelresult;

  if (cpanelResult) {
    if (cpanelResult.error) {
      throw new CpanelWhmApiError(cpanelResult.error);
    }

    if (cpanelResult.event?.result === 0) {
      const data = cpanelResult.data;
      const reason =
        (Array.isArray(data) && typeof data[0] === "object" && data[0] !== null
          ? (data[0] as { reason?: string }).reason
          : undefined) ||
        (typeof data === "object" && data !== null
          ? (data as { reason?: string }).reason
          : undefined) ||
        cpanelResult.errors?.[0];

      throw new CpanelWhmApiError(reason || "CPANEL_UAPI_FAILED");
    }

    return (cpanelResult.data ?? []) as T;
  }

  if (payload.metadata?.result === 0) {
    throw new CpanelWhmApiError(payload.metadata.reason || "CPANEL_WHM_REQUEST_FAILED");
  }

  return (payload.data ?? payload) as T;
}

function splitEmailAddress(address: string) {
  const normalized = address.trim().toLowerCase();
  const atIndex = normalized.lastIndexOf("@");

  if (atIndex <= 0 || atIndex === normalized.length - 1) {
    throw new CpanelWhmApiError("CPANEL_INVALID_EMAIL_ADDRESS");
  }

  return {
    localPart: normalized.slice(0, atIndex),
    domain: normalized.slice(atIndex + 1),
  };
}

export function createCpanelWhmClient(config: CpanelWhmConfig) {
  const baseUrl = buildBaseUrl(config);
  const authorization = `whm ${config.username}:${config.apiToken}`;

  async function fetchJson<T>(
    endpoint: string,
    params: Record<string, string | number | undefined> = {},
    method: "GET" | "POST" = "GET"
  ): Promise<T> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    // POST keeps secrets (new passwords) out of URLs and WHM access logs.
    const query = buildQuery(params);
    const url = method === "GET" ? `${baseUrl}/json-api/${endpoint}?${query}` : `${baseUrl}/json-api/${endpoint}`;

    try {
      const response = await fetch(url, {
        method,
        headers:
          method === "GET"
            ? { Authorization: authorization }
            : { Authorization: authorization, "Content-Type": "application/x-www-form-urlencoded" },
        ...(method === "POST" ? { body: query } : {}),
        signal: controller.signal,
      });

      const text = await response.text();
      let payload: T;

      try {
        payload = text ? (JSON.parse(text) as T) : ({} as T);
      } catch {
        if (!response.ok) {
          throw new CpanelWhmApiError(`HTTP_${response.status}`);
        }
        throw new CpanelWhmApiError("CPANEL_INVALID_JSON");
      }

      if (!response.ok) {
        const errorPayload = payload as WhmApiResponse & CpanelApiResponse;
        throw new CpanelWhmApiError(
          errorPayload.metadata?.reason ||
            errorPayload.error ||
            errorPayload.cpanelresult?.error ||
            `HTTP_${response.status}`
        );
      }

      return payload;
    } catch (error) {
      if (error instanceof CpanelWhmApiError) {
        throw error;
      }
      if (error instanceof Error && error.name === "AbortError") {
        throw new CpanelWhmApiError("CPANEL_WHM_TIMEOUT");
      }
      throw new CpanelWhmApiError(
        error instanceof Error ? error.message : "CPANEL_WHM_REQUEST_FAILED"
      );
    } finally {
      clearTimeout(timeout);
    }
  }

  async function requestWhm(
    endpoint: string,
    params: Record<string, string | number | undefined> = {},
    method: "GET" | "POST" = "GET"
  ) {
    const payload = await fetchJson<WhmApiResponse>(endpoint, params, method);

    if (payload.metadata?.result === 0) {
      throw new CpanelWhmApiError(payload.metadata.reason || "CPANEL_WHM_REQUEST_FAILED");
    }

    return payload;
  }

  async function requestCpanel<T = unknown>(
    params: Record<string, string | number | undefined>
  ) {
    const payload = await fetchJson<CpanelApiResponse>("cpanel", params);
    return parseCpanelApiData<T>(payload);
  }

  return {
    testConnection: () => requestWhm("version"),
    createAccount: (params: {
      username: string;
      domain: string;
      plan: string;
      contactemail: string;
      password: string;
    }) => requestWhm("createacct", params),
    suspendAccount: (username: string, reason?: string) =>
      requestWhm("suspendacct", { user: username, reason }),
    unsuspendAccount: (username: string) =>
      requestWhm("unsuspendacct", { user: username }),
    terminateAccount: (username: string) =>
      requestWhm("removeacct", { username, keepdns: 0 }),
    changePackage: (username: string, newPlan: string) =>
      requestWhm("changepackage", { user: username, pkg: newPlan }),
    /**
     * One-time login URL (WHM API 1 create_user_session). service "cpaneld"
     * (cPanel) or "webmaild"; `app` opens a cPanel app (FileManager_Home …).
     */
    createUserSession: async (
      username: string,
      service: "cpaneld" | "webmaild",
      app?: string
    ): Promise<WhmUserSession> => {
      const payload = await requestWhm("create_user_session", { user: username, service, app });
      const data = (payload.data ?? {}) as { url?: unknown; expires?: unknown };
      if (typeof data.url !== "string" || !/^https?:\/\//.test(data.url)) {
        throw new CpanelWhmApiError("CPANEL_SESSION_URL_MISSING");
      }
      return { url: data.url, expires: typeof data.expires === "number" ? data.expires : undefined };
    },
    /** Changes the cPanel account password (POST: the password never appears in a URL). */
    setPassword: (username: string, password: string) =>
      requestWhm("passwd", { user: username, password }, "POST"),
    accountSummary: async (username: string): Promise<WhmAccountRow | null> => {
      const payload = await requestWhm("accountsummary", { user: username });
      const rows = ((payload.data ?? {}) as { acct?: WhmAccountRow[] }).acct;
      return Array.isArray(rows) && rows[0] ? rows[0] : null;
    },
    /** Read-only: every account the token can see (a reseller sees its own accounts). */
    listAccounts: async (): Promise<WhmAccountRow[]> => {
      const payload = await requestWhm("listaccts", {
        want: "user,domain,email,plan,ip,diskused,disklimit,suspended,suspendreason,unix_startdate,owner",
      });
      const rows = ((payload.data ?? {}) as { acct?: WhmAccountRow[] }).acct;
      return Array.isArray(rows) ? rows : [];
    },
    /** This month's bandwidth for every visible account, or one account (`username`). */
    showBandwidth: async (username?: string): Promise<WhmBandwidthRow[]> => {
      // `search` may match as a pattern/substring: filter to the exact user.
      const payload = await requestWhm("showbw", username ? { searchtype: "user", search: username } : {});
      const rows = ((payload.data ?? {}) as { acct?: WhmBandwidthRow[] }).acct;
      const list = Array.isArray(rows) ? rows : [];
      return username ? list.filter((row) => row?.user === username) : list;
    },
    listPackages: async (): Promise<WhmPackageRow[]> => {
      const payload = await requestWhm("listpkgs");
      const rows = ((payload.data ?? {}) as { pkg?: WhmPackageRow[] }).pkg;
      return Array.isArray(rows) ? rows.filter((row) => typeof row?.name === "string") : [];
    },
    cpanelApi: (
      user: string,
      module: string,
      func: string,
      params: Record<string, string | number | undefined> = {}
    ) =>
      requestCpanel({
        cpanel_jsonapi_user: user,
        cpanel_jsonapi_module: module,
        cpanel_jsonapi_func: func,
        cpanel_jsonapi_apiversion: 3,
        ...params,
      }),
    createEmailAccount: (user: string, email: string, password: string, quotaMb: number) => {
      const { localPart, domain } = splitEmailAddress(email);

      return requestCpanel({
        cpanel_jsonapi_user: user,
        cpanel_jsonapi_module: "Email",
        cpanel_jsonapi_func: "add_pop",
        cpanel_jsonapi_apiversion: 3,
        email: localPart,
        domain,
        password,
        quota: quotaMb,
      });
    },
    deleteEmailAccount: (user: string, email: string) => {
      const { localPart, domain } = splitEmailAddress(email);

      return requestCpanel({
        cpanel_jsonapi_user: user,
        cpanel_jsonapi_module: "Email",
        cpanel_jsonapi_func: "delete_pop",
        cpanel_jsonapi_apiversion: 3,
        email: localPart,
        domain,
      });
    },
    listEmailAccounts: (user: string) =>
      requestCpanel<CpanelEmailAccount[] | CpanelEmailAccount>({
        cpanel_jsonapi_user: user,
        cpanel_jsonapi_module: "Email",
        cpanel_jsonapi_func: "list_pops",
        cpanel_jsonapi_apiversion: 3,
      }).then((data) => {
          const items = Array.isArray(data)
            ? (data as CpanelEmailAccount[])
            : data
              ? [data as CpanelEmailAccount]
              : [];

          return items.map((item) => {
            const localPart = item.user || item.email || "";
            const domain = item.domain || "";
            const address =
              localPart.includes("@") || !domain
                ? localPart
                : `${localPart}@${domain}`;

            return {
              address: address.toLowerCase(),
              quotaMb:
                typeof item.quota === "number"
                  ? item.quota
                  : Number.parseInt(String(item.quota ?? "0"), 10) || 0,
              diskUsedMb:
                typeof item.diskused === "number"
                  ? item.diskused
                  : Number.parseInt(String(item.diskused ?? "0"), 10) || 0,
            };
          });
        }),
  };
}

export type CpanelWhmClient = ReturnType<typeof createCpanelWhmClient>;