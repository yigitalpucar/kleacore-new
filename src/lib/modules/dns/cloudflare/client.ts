/**
 * Minimal Cloudflare API v4 client for the DNS module: bearer token auth,
 * envelope parsing, pagination and 429 handling (Retry-After). Never logs the
 * token. Errors are thrown as CloudflareApiError with a Turkish user message
 * (cloudflareUserMessage) — the module turns them into IntegrationResults.
 */

export const CLOUDFLARE_API_BASE = "https://api.cloudflare.com/client/v4";

export interface CloudflareError {
  code: number;
  message: string;
  error_chain?: CloudflareError[];
}

export interface CloudflareResultInfo {
  page?: number;
  per_page?: number;
  total_pages?: number;
  count?: number;
  total_count?: number;
}

interface CloudflareEnvelope<T> {
  success: boolean;
  errors?: CloudflareError[];
  messages?: unknown[];
  result: T;
  result_info?: CloudflareResultInfo;
}

/**
 * Turkish messages for the Cloudflare error codes users and admins actually
 * hit. Unknown codes fall back to a generic message with the code.
 */
const ERROR_MESSAGES: Record<number, string> = {
  // auth / token
  6003: "Cloudflare API token geçersiz.",
  6111: "Cloudflare API token geçersiz.",
  6100: "Cloudflare API token geçersiz.",
  9103: "Cloudflare API token geçersiz.",
  9106: "Cloudflare API token eksik veya geçersiz.",
  9109: "Cloudflare zone bulunamadı ya da token bu zone'a erişemiyor.",
  10000: "Cloudflare API token bu işlem için yetkili değil (Zone:Read, Zone:Edit, DNS:Edit gerekli).",
  1000: "Cloudflare API token geçersiz.",
  // zones
  1001: "Cloudflare zone bulunamadı.",
  7003: "Cloudflare zone bulunamadı.",
  7000: "Cloudflare zone bulunamadı.",
  1049: "Alan adı Cloudflare'de eklenemedi: kayıtlı (registered) bir alan adı değil.",
  1061: "Bu alan adı başka bir Cloudflare hesabında zaten ekli. Önce oradan kaldırılmalı.",
  1097: "Bu alan adı Cloudflare'e eklenemiyor (engelli veya desteklenmeyen alan adı).",
  1099: "Bu alan adı Cloudflare'e eklenemiyor (geçersiz alan adı).",
  1105: "Cloudflare hesabında çok fazla bekleyen (pending) zone var; önce mevcutları etkinleştirin.",
  1116: "Cloudflare hesap sınırına ulaşıldı (zone sayısı).",
  1224: "Bu alan adı Cloudflare'de zaten bekleyen bir işlem altında.",
  // records
  81044: "DNS kaydı bulunamadı.",
  81053: "Bu ad için zaten bir A, AAAA veya CNAME kaydı var; CNAME başka kayıtla aynı adda olamaz.",
  81054: "Bu ad için zaten bir CNAME kaydı var; aynı ada başka kayıt eklenemez.",
  81055: "Bu ad için zaten bir CNAME kaydı var.",
  81056: "Bu ad için CNAME ile çakışan kayıtlar var.",
  81057: "Aynı DNS kaydı zaten mevcut.",
  81058: "Aynı DNS kaydı zaten mevcut.",
  81045: "DNS kayıt sınırına ulaşıldı.",
  1004: "DNS kaydı Cloudflare doğrulamasından geçmedi; değerleri kontrol edin.",
  9000: "DNS kayıt adı geçersiz.",
  9004: "Bu kayıt tipi Cloudflare proxy (turuncu bulut) ile kullanılamaz.",
  9005: "A kaydının değeri geçerli bir IPv4 adresi olmalı.",
  9006: "AAAA kaydının değeri geçerli bir IPv6 adresi olmalı.",
  9007: "CNAME hedefi geçersiz.",
  9008: "MX hedefi geçersiz.",
  9009: "TXT değeri geçersiz.",
  9011: "SRV kaydı geçersiz.",
  9021: "TTL değeri geçersiz.",
  9039: "Bu adres Cloudflare proxy ile kullanılamaz (özel/yerel IP).",
  9041: "Bu kayıt Cloudflare proxy ile kullanılamaz.",
  9100: "Ad sunucusu (NS) kaydı zone kökünde değiştirilemez.",
  // rate limit
  971: "Cloudflare istek sınırına ulaşıldı; birkaç dakika sonra tekrar deneyin.",
  10013: "Cloudflare istek sınırına ulaşıldı; birkaç dakika sonra tekrar deneyin.",
};

export const CLOUDFLARE_RATE_LIMIT_MESSAGE = "Cloudflare istek sınırına ulaşıldı; birkaç dakika sonra tekrar deneyin.";
export const CLOUDFLARE_UNREACHABLE_MESSAGE = "Cloudflare API'ye ulaşılamadı; daha sonra tekrar deneyin.";

function flattenErrors(errors: CloudflareError[] = []): CloudflareError[] {
  return errors.flatMap((error) => [error, ...flattenErrors(error.error_chain)]);
}

/** Turkish message for a Cloudflare failure (first known code wins, chain included). */
export function cloudflareUserMessage(errors: CloudflareError[] = [], status?: number): string {
  for (const error of flattenErrors(errors)) {
    const message = ERROR_MESSAGES[error.code];
    if (message) return message;
  }
  if (status === 429) return CLOUDFLARE_RATE_LIMIT_MESSAGE;
  if (status === 401 || status === 403) return ERROR_MESSAGES[10000];
  if (status === 404) return "Cloudflare kaynağı bulunamadı.";
  const first = errors[0];
  if (first) return `Cloudflare işlemi başarısız (kod ${first.code}).`;
  if (status && status >= 500) return "Cloudflare geçici bir hata döndürdü; daha sonra tekrar deneyin.";
  return status ? `Cloudflare işlemi başarısız (HTTP ${status}).` : CLOUDFLARE_UNREACHABLE_MESSAGE;
}

export class CloudflareApiError extends Error {
  readonly codes: number[];
  constructor(
    readonly status: number,
    readonly errors: CloudflareError[],
    readonly userMessage: string = cloudflareUserMessage(errors, status)
  ) {
    super(userMessage);
    this.name = "CloudflareApiError";
    this.codes = flattenErrors(errors).map((error) => error.code);
  }

  has(code: number) {
    return this.codes.includes(code);
  }

  get isNotFound() {
    return this.status === 404 || this.has(81044) || this.has(7003) || this.has(1001);
  }
}

export interface CloudflareClientOptions {
  apiToken: string;
  baseUrl?: string;
  /** Injected in tests; defaults to setTimeout. */
  sleep?: (ms: number) => Promise<void>;
  /** 429 retries after the first attempt (default 3). */
  maxRetries?: number;
  /** Upper bound for one Retry-After wait (default 30 s). */
  maxRetryWaitMs?: number;
  timeoutMs?: number;
}

type Query = Record<string, string | number | boolean | undefined>;

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** Retry-After is seconds (or an HTTP date); missing → exponential 1 s, 2 s, 4 s. */
export function retryAfterMs(header: string | null, attempt: number): number {
  if (header) {
    const seconds = Number(header);
    if (Number.isFinite(seconds) && seconds >= 0) return seconds * 1000;
    const date = Date.parse(header);
    if (Number.isFinite(date)) return Math.max(0, date - Date.now());
  }
  return 1000 * 2 ** attempt;
}

/** Hard stop for pagination loops (5000 records/zones at per_page 100). */
const MAX_PAGES = 50;

export function createCloudflareClient(options: CloudflareClientOptions) {
  const baseUrl = (options.baseUrl ?? CLOUDFLARE_API_BASE).replace(/\/$/, "");
  const sleep = options.sleep ?? defaultSleep;
  const maxRetries = options.maxRetries ?? 3;
  const maxRetryWaitMs = options.maxRetryWaitMs ?? 30_000;
  const timeoutMs = options.timeoutMs ?? 15_000;

  function buildUrl(path: string, query?: Query) {
    const url = new URL(`${baseUrl}${path}`);
    for (const [key, value] of Object.entries(query ?? {})) {
      if (value !== undefined) url.searchParams.set(key, String(value));
    }
    return url.toString();
  }

  async function send<T>(
    method: string,
    path: string,
    init: { query?: Query; body?: unknown } = {}
  ): Promise<CloudflareEnvelope<T>> {
    const url = buildUrl(path, init.query);

    for (let attempt = 0; ; attempt++) {
      let response: Response;
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        response = await fetch(url, {
          method,
          headers: {
            authorization: `Bearer ${options.apiToken}`,
            accept: "application/json",
            ...(init.body !== undefined ? { "content-type": "application/json" } : {}),
          },
          body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
          signal: controller.signal,
        });
      } catch {
        throw new CloudflareApiError(0, [], CLOUDFLARE_UNREACHABLE_MESSAGE);
      } finally {
        clearTimeout(timer);
      }

      // A 429 was rejected before processing, so retrying (even a POST) is safe.
      if (response.status === 429) {
        if (attempt >= maxRetries) {
          throw new CloudflareApiError(429, [{ code: 971, message: "rate limited" }], CLOUDFLARE_RATE_LIMIT_MESSAGE);
        }
        await sleep(Math.min(retryAfterMs(response.headers.get("retry-after"), attempt), maxRetryWaitMs));
        continue;
      }

      let payload: CloudflareEnvelope<T> | null = null;
      try {
        payload = (await response.json()) as CloudflareEnvelope<T>;
      } catch {
        payload = null;
      }

      if (!response.ok || !payload || payload.success === false) {
        throw new CloudflareApiError(response.status, payload?.errors ?? []);
      }
      return payload;
    }
  }

  return {
    async request<T>(method: string, path: string, init: { query?: Query; body?: unknown } = {}): Promise<T> {
      return (await send<T>(method, path, init)).result;
    },

    /** Every page of a list endpoint (stops at total_pages or an empty/short page). */
    async paginate<T>(path: string, query: Query = {}, perPage = 100): Promise<T[]> {
      const items: T[] = [];
      for (let page = 1; page <= MAX_PAGES; page++) {
        const envelope = await send<T[]>("GET", path, { query: { ...query, page, per_page: perPage } });
        const result = envelope.result ?? [];
        items.push(...result);
        const totalPages = envelope.result_info?.total_pages;
        if (totalPages !== undefined ? page >= totalPages : result.length < perPage) break;
        if (result.length === 0) break;
      }
      return items;
    },
  };
}

export type CloudflareClient = ReturnType<typeof createCloudflareClient>;
