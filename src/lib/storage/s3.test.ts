import { describe, expect, it, vi } from "vitest";
import { InvalidStorageKeyError } from "./keys";
import { S3StorageDriver } from "./s3";

function driver(fetchImpl: typeof fetch, forcePathStyle = true) {
  return new S3StorageDriver(
    {
      endpoint: "https://s3.example.com",
      region: "eu-central-1",
      bucket: "kleacore-uploads",
      accessKeyId: "AKIA",
      secretAccessKey: "secret",
      forcePathStyle,
    },
    fetchImpl
  );
}

describe("S3StorageDriver", () => {
  it("signs PUT/GET/DELETE against path-style object URLs", async () => {
    const calls: Request[] = [];
    const fetchImpl = vi.fn(async (request: Request) => {
      calls.push(request);
      if (request.method === "GET") return new Response("veri", { status: 200 });
      return new Response(null, { status: 200 });
    }) as unknown as typeof fetch;
    const s3 = driver(fetchImpl);

    await s3.put("tickets/2026/10/abc", Buffer.from("veri"), { contentType: "application/pdf" });
    expect((await s3.get("tickets/2026/10/abc"))?.toString()).toBe("veri");
    await s3.delete("tickets/2026/10/abc");

    expect(calls.map((c) => [c.method, c.url])).toEqual([
      ["PUT", "https://s3.example.com/kleacore-uploads/tickets/2026/10/abc"],
      ["GET", "https://s3.example.com/kleacore-uploads/tickets/2026/10/abc"],
      ["DELETE", "https://s3.example.com/kleacore-uploads/tickets/2026/10/abc"],
    ]);
    expect(calls[0].headers.get("authorization")).toMatch(/^AWS4-HMAC-SHA256 Credential=AKIA\/\d{8}\/eu-central-1\/s3\/aws4_request/);
    expect(calls[0].headers.get("content-type")).toBe("application/pdf");
  });

  it("returns null for a missing object and uses virtual-host URLs when asked", async () => {
    const fetchImpl = vi.fn(async () => new Response(null, { status: 404 })) as unknown as typeof fetch;
    const s3 = driver(fetchImpl, false);
    expect(await s3.get("tickets/2026/10/abc")).toBeNull();
    expect(s3.objectUrl("tickets/2026/10/abc")).toBe("https://kleacore-uploads.s3.example.com/tickets/2026/10/abc");
  });

  it("never sends a request for an invalid key", async () => {
    const fetchImpl = vi.fn() as unknown as typeof fetch;
    await expect(driver(fetchImpl).get("../other-bucket/x")).rejects.toThrow(InvalidStorageKeyError);
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
