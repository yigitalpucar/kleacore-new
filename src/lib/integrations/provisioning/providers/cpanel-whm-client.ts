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
    params: Record<string, string | number | undefined> = {}
  ): Promise<T> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    const url = `${baseUrl}/json-api/${endpoint}?${buildQuery(params)}`;

    try {
      const response = await fetch(url, {
        method: "GET",
        headers: { Authorization: authorization },
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
    params: Record<string, string | number | undefined> = {}
  ) {
    const payload = await fetchJson<WhmApiResponse>(endpoint, params);

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