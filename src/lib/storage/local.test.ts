import { mkdtemp, readdir, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { generateStorageKey, isValidStorageKey, InvalidStorageKeyError } from "./keys";
import { LocalStorageDriver } from "./local";

let root: string;
let driver: LocalStorageDriver;

beforeEach(async () => {
  root = await mkdtemp(path.join(tmpdir(), "kc-storage-"));
  driver = new LocalStorageDriver(path.join(root, "uploads"));
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

describe("storage keys", () => {
  it("are random, dated and pattern-safe", () => {
    const key = generateStorageKey("tickets", new Date("2026-10-08T12:00:00Z"));
    expect(key).toMatch(/^tickets\/2026\/10\/[0-9a-f-]{36}$/);
    expect(generateStorageKey("tickets")).not.toBe(generateStorageKey("tickets"));
  });

  it.each([
    "../secret",
    "tickets/../../etc/passwd",
    "/etc/passwd",
    "tickets/2026/10/..",
    "tickets\\..\\x",
    "tickets/2026/10/a b",
    "tickets/2026/10/Fatura.pdf",
    "tickets//x",
    "tickets/%2e%2e/x",
    "",
  ])("rejects %j", (key) => {
    expect(isValidStorageKey(key)).toBe(false);
    expect(() => driver.resolve(key)).toThrow(InvalidStorageKeyError);
  });
});

describe("LocalStorageDriver", () => {
  it("writes, reads and deletes files only inside its root", async () => {
    const key = generateStorageKey("tickets");
    await driver.put(key, Buffer.from("içerik"), { contentType: "text/plain" });

    const full = driver.resolve(key);
    expect(full.startsWith(path.join(root, "uploads") + path.sep)).toBe(true);
    expect((await driver.get(key))?.toString()).toBe("içerik");
    expect((await stat(full)).mode & 0o777).toBe(0o600);

    await driver.delete(key);
    expect(await driver.get(key)).toBeNull();
    await driver.delete(key); // idempotent
  });

  it("leaves no temp files behind and refuses traversal on every operation", async () => {
    const key = generateStorageKey("tickets");
    await driver.put(key, Buffer.from("x"), { contentType: "text/plain" });
    expect(await readdir(path.dirname(driver.resolve(key)))).toHaveLength(1);

    await expect(driver.put("../escape", Buffer.from("x"), { contentType: "text/plain" })).rejects.toThrow(InvalidStorageKeyError);
    await expect(driver.get("../../etc/passwd")).rejects.toThrow(InvalidStorageKeyError);
    await expect(driver.delete("tickets/../../x")).rejects.toThrow(InvalidStorageKeyError);
    expect(await readdir(root)).toEqual(["uploads"]);
  });
});
