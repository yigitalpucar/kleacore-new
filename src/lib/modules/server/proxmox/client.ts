/**
 * Minimal Proxmox VE API client (api2/json) for the proxmox server module.
 *
 * - Auth: API token header `Authorization: PVEAPIToken=<user@realm!token>=<secret>`
 *   (no ticket/CSRF dance; the secret never leaves the server).
 * - Transport: global fetch when the node has a publicly trusted certificate;
 *   node:https when the admin pinned the PVE CA (`caCert`) or turned TLS
 *   verification off (self-signed test nodes). Tests stub global fetch.
 * - Async endpoints return a task UPID; `waitForTask` polls
 *   /nodes/{node}/tasks/{upid}/status with backoff until it stops.
 */
import { request as httpsRequest } from "node:https";

export interface ProxmoxClientConfig {
  apiUrl: string;
  tokenId: string;
  tokenSecret: string;
  verifyTls: boolean;
  /** PEM of the PVE root CA (/etc/pve/pve-root-ca.pem) to verify a self-signed node. */
  caCert?: string;
  /** Per-request timeout. */
  requestTimeoutMs?: number;
}

export interface ProxmoxRequest {
  method: "GET" | "POST" | "PUT" | "DELETE";
  url: string;
  headers: Record<string, string>;
  body?: string;
  timeoutMs: number;
}

export interface ProxmoxResponse {
  status: number;
  statusText: string;
  text: string;
}

export type ProxmoxTransport = (request: ProxmoxRequest) => Promise<ProxmoxResponse>;

export interface ProxmoxRuntime {
  sleep(ms: number): Promise<void>;
  now(): number;
}

export const realRuntime: ProxmoxRuntime = {
  sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  now: () => Date.now(),
};

export class ProxmoxApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly path: string
  ) {
    super(message);
    this.name = "ProxmoxApiError";
  }

  get isNotFound() {
    return this.status === 404 || /does not exist|not found|no such/i.test(this.message);
  }

  get isConflict() {
    return /already exists|in use|config file already/i.test(this.message);
  }
}

export class ProxmoxTaskError extends Error {
  constructor(
    message: string,
    readonly upid: string,
    readonly timedOut = false
  ) {
    super(message);
    this.name = "ProxmoxTaskError";
  }
}

const fetchTransport: ProxmoxTransport = async (request) => {
  const response = await fetch(request.url, {
    method: request.method,
    headers: request.headers,
    body: request.body,
    signal: AbortSignal.timeout(request.timeoutMs),
    cache: "no-store",
  });
  return { status: response.status, statusText: response.statusText, text: await response.text() };
};

function httpsTransport(options: { rejectUnauthorized: boolean; ca?: string }): ProxmoxTransport {
  return (request) =>
    new Promise((resolve, reject) => {
      const req = httpsRequest(
        request.url,
        {
          method: request.method,
          headers: request.body
            ? { ...request.headers, "content-length": String(Buffer.byteLength(request.body)) }
            : request.headers,
          rejectUnauthorized: options.rejectUnauthorized,
          ca: options.ca,
          timeout: request.timeoutMs,
        },
        (res) => {
          const chunks: Buffer[] = [];
          res.on("data", (chunk: Buffer) => chunks.push(chunk));
          res.on("end", () =>
            resolve({
              status: res.statusCode ?? 0,
              statusText: res.statusMessage ?? "",
              text: Buffer.concat(chunks).toString("utf8"),
            })
          );
          res.on("error", reject);
        }
      );
      req.on("timeout", () => req.destroy(new Error(`timeout after ${request.timeoutMs} ms`)));
      req.on("error", reject);
      if (request.body) req.write(request.body);
      req.end();
    });
}

/** fetch for a publicly trusted certificate, node:https for a pinned CA or no verification. */
export function transportFor(config: Pick<ProxmoxClientConfig, "verifyTls" | "caCert">): ProxmoxTransport {
  const ca = config.caCert?.trim();
  if (!config.verifyTls) return httpsTransport({ rejectUnauthorized: false });
  if (ca) return httpsTransport({ rejectUnauthorized: true, ca });
  return fetchTransport;
}

export type ProxmoxParams = Record<string, string | number | boolean | undefined | null>;

function encodeParams(params: ProxmoxParams) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null) continue;
    search.set(key, typeof value === "boolean" ? (value ? "1" : "0") : String(value));
  }
  return search;
}

/** Node that runs a task, from its UPID ("UPID:pve1:…"). */
export function upidNode(upid: string) {
  return upid.split(":")[1] || "";
}

export function isUpid(value: unknown): value is string {
  return typeof value === "string" && value.startsWith("UPID:");
}

export interface TaskStatus {
  status: "running" | "stopped" | string;
  exitstatus?: string;
}

export function createProxmoxClient(
  config: ProxmoxClientConfig,
  options: { transport?: ProxmoxTransport; runtime?: ProxmoxRuntime } = {}
) {
  const base = `${config.apiUrl.trim().replace(/\/+$/, "")}/api2/json`;
  const transport = options.transport ?? transportFor(config);
  const runtime = options.runtime ?? realRuntime;
  const timeoutMs = config.requestTimeoutMs ?? 30_000;
  const authorization = `PVEAPIToken=${config.tokenId.trim()}=${config.tokenSecret.trim()}`;

  async function call<T>(method: ProxmoxRequest["method"], path: string, params: ProxmoxParams = {}): Promise<T> {
    const encoded = encodeParams(params);
    const hasBody = method === "POST" || method === "PUT";
    const query = !hasBody && [...encoded.keys()].length ? `?${encoded.toString()}` : "";
    const headers: Record<string, string> = { authorization, accept: "application/json" };
    if (hasBody) headers["content-type"] = "application/x-www-form-urlencoded";

    let response: ProxmoxResponse;
    try {
      response = await transport({
        method,
        url: `${base}${path}${query}`,
        headers,
        body: hasBody ? encoded.toString() : undefined,
        timeoutMs,
      });
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      throw new ProxmoxApiError(`Proxmox'a ulaşılamadı: ${reason}`, 0, path);
    }

    let payload: { data?: unknown; errors?: Record<string, string>; message?: string } | null = null;
    try {
      payload = response.text ? JSON.parse(response.text) : null;
    } catch {
      payload = null;
    }

    if (response.status < 200 || response.status >= 300) {
      // PVE puts the reason in the HTTP status line; parameter errors in `errors`.
      const details = [
        response.statusText,
        payload?.message,
        payload?.errors ? Object.entries(payload.errors).map(([key, value]) => `${key}: ${value}`).join("; ") : "",
        !payload && response.text ? response.text.slice(0, 200) : "",
      ]
        .map((part) => (part ?? "").trim())
        .filter(Boolean)
        .join(" — ");
      const auth = response.status === 401 ? " (API token reddedildi)" : response.status === 403 ? " (yetki yok)" : "";
      throw new ProxmoxApiError(`HTTP ${response.status}${auth}: ${details || "Proxmox hatası"}`, response.status, path);
    }

    return (payload?.data ?? null) as T;
  }

  async function taskStatus(upid: string): Promise<TaskStatus> {
    return call<TaskStatus>("GET", `/nodes/${encodeURIComponent(upidNode(upid))}/tasks/${encodeURIComponent(upid)}/status`);
  }

  /**
   * Polls a task until it stops (backoff 1 s → 5 s). Throws ProxmoxTaskError
   * when it ends with an error or does not finish within `timeoutMs` (the
   * task keeps running on the node; callers resume by polling it again).
   */
  async function waitForTask(upid: string, waitOptions: { timeoutMs: number }) {
    const deadline = runtime.now() + waitOptions.timeoutMs;
    let delay = 1_000;
    for (;;) {
      const status = await taskStatus(upid);
      if (status?.status === "stopped") {
        if (status.exitstatus && status.exitstatus !== "OK" && !status.exitstatus.startsWith("WARNINGS")) {
          throw new ProxmoxTaskError(`Proxmox görevi başarısız: ${status.exitstatus}`, upid);
        }
        return status;
      }
      if (runtime.now() + delay > deadline) {
        throw new ProxmoxTaskError(
          `Proxmox görevi ${Math.round(waitOptions.timeoutMs / 1000)} sn içinde bitmedi (sürüyor)`,
          upid,
          true
        );
      }
      await runtime.sleep(delay);
      delay = Math.min(delay + 1_000, 5_000);
    }
  }

  async function taskLog(upid: string, limit = 200) {
    const lines = await call<Array<{ n: number; t: string }>>(
      "GET",
      `/nodes/${encodeURIComponent(upidNode(upid))}/tasks/${encodeURIComponent(upid)}/log`,
      { limit }
    );
    return (lines ?? []).map((line) => line.t);
  }

  return {
    get: <T>(path: string, params?: ProxmoxParams) => call<T>("GET", path, params),
    post: <T>(path: string, params?: ProxmoxParams) => call<T>("POST", path, params),
    put: <T>(path: string, params?: ProxmoxParams) => call<T>("PUT", path, params),
    del: <T>(path: string, params?: ProxmoxParams) => call<T>("DELETE", path, params),
    taskStatus,
    waitForTask,
    taskLog,
    runtime,
  };
}

export type ProxmoxClient = ReturnType<typeof createProxmoxClient>;
