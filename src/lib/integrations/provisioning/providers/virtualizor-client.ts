import type { VpsVdsConfig } from "../types";

const REQUEST_TIMEOUT_MS = 20000;

interface VirtualizorResponse {
  done?: Record<string, unknown> | number | string;
  error?: string | string[];
  title?: string;
  vs?: Record<string, { vpsid?: string | number; hostname?: string }>;
  vpsid?: string | number;
}

export class VirtualizorApiError extends Error {
  constructor(
    message: string,
    readonly code = "VIRTUALIZOR_API_ERROR"
  ) {
    super(message);
    this.name = "VirtualizorApiError";
  }
}

function normalizeBaseUrl(config: VpsVdsConfig) {
  if (!config.apiUrl) {
    throw new VirtualizorApiError("VIRTUALIZOR_URL_MISSING");
  }
  return config.apiUrl.replace(/\/+$/, "");
}

function extractError(payload: VirtualizorResponse) {
  if (!payload.error) return null;
  return Array.isArray(payload.error) ? payload.error.join(", ") : payload.error;
}

export function createVirtualizorClient(config: VpsVdsConfig) {
  const baseUrl = normalizeBaseUrl(config);

  async function request(
    act: string,
    params: Record<string, string | number | undefined> = {}
  ): Promise<VirtualizorResponse> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    const body = new URLSearchParams();
    body.set("api", "serialize");
    body.set("apikey", config.apiKey || "");
    body.set("apipass", config.apiPassword || "");
    body.set("act", act);

    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== "") {
        body.set(key, String(value));
      }
    }

    const url = `${baseUrl}/index.php`;

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: body.toString(),
        signal: controller.signal,
      });

      const text = await response.text();
      let payload: VirtualizorResponse;

      try {
        payload = text ? (JSON.parse(text) as VirtualizorResponse) : {};
      } catch {
        if (!response.ok) {
          throw new VirtualizorApiError(`HTTP_${response.status}`);
        }
        throw new VirtualizorApiError("VIRTUALIZOR_INVALID_JSON");
      }

      if (!response.ok) {
        throw new VirtualizorApiError(extractError(payload) || `HTTP_${response.status}`);
      }

      const errorMessage = extractError(payload);
      if (errorMessage) {
        throw new VirtualizorApiError(errorMessage);
      }

      return payload;
    } catch (error) {
      if (error instanceof VirtualizorApiError) {
        throw error;
      }
      if (error instanceof Error && error.name === "AbortError") {
        throw new VirtualizorApiError("VIRTUALIZOR_TIMEOUT");
      }
      throw new VirtualizorApiError(
        error instanceof Error ? error.message : "VIRTUALIZOR_REQUEST_FAILED"
      );
    } finally {
      clearTimeout(timeout);
    }
  }

  return {
    testConnection: () => request("listvs"),
    createVps: (params: {
      plid: string;
      hostname: string;
      rootpass: string;
      user_email: string;
      virt?: string;
    }) => request("addvs", params),
    manageVps: (vpsid: string, action: "start" | "stop" | "restart" | "suspend" | "unsuspend") =>
      request("vpsmanage", { vpsid, action }),
    deleteVps: (vpsid: string) => request("deletevs", { vpsid }),
  };
}

export type VirtualizorClient = ReturnType<typeof createVirtualizorClient>;