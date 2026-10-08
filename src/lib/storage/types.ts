/**
 * Private object storage for user uploads (ticket attachments, inbound mail
 * files). Objects are addressed only by server-generated random keys
 * (see keys.ts); user-supplied names never reach a path or an object key.
 */
export interface StoragePutOptions {
  contentType: string;
}

export interface StorageDriver {
  /** "local" | "s3" — stored next to each key so a later driver switch can still read old files. */
  readonly name: StorageDriverName;
  put(key: string, data: Buffer, options: StoragePutOptions): Promise<void>;
  /** Null when the object does not exist. */
  get(key: string): Promise<Buffer | null>;
  /** Idempotent: deleting a missing object is not an error. */
  delete(key: string): Promise<void>;
}

export type StorageDriverName = "local" | "s3";
