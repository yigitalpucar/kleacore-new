import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { assertValidStorageKey, InvalidStorageKeyError } from "./keys";
import type { StorageDriver, StoragePutOptions } from "./types";

/**
 * Files on a local directory — in production a Docker volume mounted at
 * /app/uploads (docs/ops-storage.md). Written with owner-only permissions,
 * atomically (temp file + rename), never under the public/ web root.
 */
export class LocalStorageDriver implements StorageDriver {
  readonly name = "local" as const;
  private readonly root: string;

  constructor(rootDir: string) {
    this.root = path.resolve(rootDir);
  }

  /** Absolute path of a key; throws for anything that would leave the root. */
  resolve(key: string): string {
    assertValidStorageKey(key);
    const full = path.resolve(this.root, ...key.split("/"));
    // Defence in depth: the key pattern already excludes "..", "/" and "\".
    if (!full.startsWith(this.root + path.sep)) throw new InvalidStorageKeyError(key);
    return full;
  }

  async put(key: string, data: Buffer, _options: StoragePutOptions): Promise<void> {
    const target = this.resolve(key);
    await mkdir(path.dirname(target), { recursive: true, mode: 0o700 });
    const temp = `${target}.${randomUUID()}.tmp`;
    await writeFile(temp, data, { mode: 0o600, flag: "wx" });
    await rename(temp, target);
  }

  async get(key: string): Promise<Buffer | null> {
    try {
      return await readFile(this.resolve(key));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
      throw error;
    }
  }

  async delete(key: string): Promise<void> {
    await rm(this.resolve(key), { force: true });
  }
}
