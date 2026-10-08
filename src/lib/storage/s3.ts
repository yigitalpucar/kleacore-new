import { AwsClient } from "aws4fetch";
import { assertValidStorageKey } from "./keys";
import type { StorageDriver, StoragePutOptions } from "./types";

export interface S3StorageConfig {
  /** e.g. https://s3.eu-central-1.amazonaws.com, https://<account>.r2.cloudflarestorage.com, http://minio:9000 */
  endpoint: string;
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  /** Path-style URLs (MinIO, most S3-compatible services). Default true. */
  forcePathStyle?: boolean;
}

/**
 * S3-compatible object storage (AWS S3, Cloudflare R2, MinIO, Wasabi …)
 * signed with SigV4. The bucket must be private; objects are only ever
 * served through the authenticated download route, never by URL.
 */
export class S3StorageDriver implements StorageDriver {
  readonly name = "s3" as const;
  private readonly client: AwsClient;

  constructor(
    private readonly config: S3StorageConfig,
    fetchImpl: typeof fetch = fetch
  ) {
    this.client = new AwsClient({
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
      region: config.region,
      service: "s3",
    });
    this.fetchImpl = fetchImpl;
  }

  private readonly fetchImpl: typeof fetch;

  objectUrl(key: string): string {
    assertValidStorageKey(key);
    const endpoint = new URL(this.config.endpoint);
    const base = endpoint.origin + endpoint.pathname.replace(/\/$/, "");
    if (this.config.forcePathStyle ?? true) {
      return `${base}/${encodeURIComponent(this.config.bucket)}/${key}`;
    }
    return `${endpoint.protocol}//${this.config.bucket}.${endpoint.host}${endpoint.pathname.replace(/\/$/, "")}/${key}`;
  }

  private async send(method: string, key: string, init: { body?: Buffer; headers?: Record<string, string> } = {}) {
    const request = await this.client.sign(this.objectUrl(key), {
      method,
      headers: init.headers,
      body: init.body ? new Uint8Array(init.body) : undefined,
    });
    return this.fetchImpl(request);
  }

  async put(key: string, data: Buffer, options: StoragePutOptions): Promise<void> {
    const response = await this.send("PUT", key, {
      body: data,
      headers: { "content-type": options.contentType, "content-length": String(data.length) },
    });
    if (!response.ok) throw new Error(`S3 PUT failed (${response.status})`);
  }

  async get(key: string): Promise<Buffer | null> {
    const response = await this.send("GET", key);
    if (response.status === 404) return null;
    if (!response.ok) throw new Error(`S3 GET failed (${response.status})`);
    return Buffer.from(await response.arrayBuffer());
  }

  async delete(key: string): Promise<void> {
    const response = await this.send("DELETE", key);
    if (!response.ok && response.status !== 404) throw new Error(`S3 DELETE failed (${response.status})`);
  }
}
