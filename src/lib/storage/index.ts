import path from "node:path";
import { LocalStorageDriver } from "./local";
import { S3StorageDriver } from "./s3";
import type { StorageDriver, StorageDriverName } from "./types";

export { generateStorageKey, isValidStorageKey, InvalidStorageKeyError } from "./keys";
export type { StorageDriver, StorageDriverName } from "./types";

/**
 * Upload storage configured from env (docs/ops-storage.md):
 *   STORAGE_DRIVER=local (default) | s3
 *   STORAGE_LOCAL_DIR   default /app/uploads in production, ./.uploads otherwise
 *   S3_ENDPOINT, S3_REGION, S3_BUCKET, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY, S3_FORCE_PATH_STYLE
 */
export function defaultLocalDir() {
  const configured = process.env.STORAGE_LOCAL_DIR?.trim();
  if (configured) return path.resolve(configured);
  return process.env.NODE_ENV === "production" ? "/app/uploads" : path.resolve(process.cwd(), ".uploads");
}

function required(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required for STORAGE_DRIVER=s3`);
  return value;
}

const drivers = new Map<StorageDriverName, StorageDriver>();

export function getStorageDriver(name?: StorageDriverName | string): StorageDriver {
  const wanted = (name ?? process.env.STORAGE_DRIVER?.trim() ?? "local") || "local";
  if (wanted !== "local" && wanted !== "s3") throw new Error(`Unknown storage driver: ${wanted}`);
  const cached = drivers.get(wanted);
  if (cached) return cached;

  const driver: StorageDriver =
    wanted === "s3"
      ? new S3StorageDriver({
          endpoint: required("S3_ENDPOINT"),
          region: process.env.S3_REGION?.trim() || "auto",
          bucket: required("S3_BUCKET"),
          accessKeyId: required("S3_ACCESS_KEY_ID"),
          secretAccessKey: required("S3_SECRET_ACCESS_KEY"),
          forcePathStyle: process.env.S3_FORCE_PATH_STYLE !== "false",
        })
      : new LocalStorageDriver(defaultLocalDir());
  drivers.set(wanted, driver);
  return driver;
}

/** Tests only. */
export function resetStorageDrivers() {
  drivers.clear();
}
