import { describe, expect, it } from "vitest";
import { BodyTooLargeError, formFiles, isSameOriginRequest, readMultipartForm } from "./http";

async function multipartRequest(form: FormData, headers: Record<string, string> = {}) {
  // Serialise first: a network body, not undici's FormData pump.
  const encoded = new Response(form);
  const body = Buffer.from(await encoded.arrayBuffer());
  return new Request("https://kleacore.com/api/support/tickets", {
    method: "POST",
    body,
    headers: { "content-type": encoded.headers.get("content-type")!, ...headers },
  });
}

describe("readMultipartForm", () => {
  it("parses files and fields under the cap", async () => {
    const form = new FormData();
    form.set("message", "Merhaba");
    form.append("files", new File([Buffer.from("%PDF-1.4")], "a.pdf", { type: "application/pdf" }));
    form.append("files", new File([], "bos.txt"));
    const parsed = await readMultipartForm(await multipartRequest(form), 1024 * 1024);
    expect(parsed.get("message")).toBe("Merhaba");
    const files = await formFiles(parsed);
    expect(files).toHaveLength(1);
    expect(files[0].name).toBe("a.pdf");
    expect(files[0].data.toString()).toBe("%PDF-1.4");
  });

  it("rejects bodies over the cap by Content-Length and by streamed size", async () => {
    const form = new FormData();
    form.append("files", new File([Buffer.alloc(4096)], "x.bin"));
    await expect(readMultipartForm(await multipartRequest(form, { "content-length": "999999999" }), 1024)).rejects.toBeInstanceOf(
      BodyTooLargeError
    );
    // No Content-Length (chunked upload): the streamed byte count trips the cap.
    await expect(readMultipartForm(await multipartRequest(form), 1024)).rejects.toBeInstanceOf(BodyTooLargeError);
  });

  it("refuses non-multipart bodies", async () => {
    const request = new Request("https://kleacore.com/x", { method: "POST", body: "{}", headers: { "content-type": "application/json" } });
    await expect(readMultipartForm(request, 1024)).rejects.toThrow("NOT_MULTIPART");
  });
});

describe("isSameOriginRequest", () => {
  const req = (origin: string | null) => ({
    headers: new Headers(origin ? { origin } : {}),
    nextUrl: new URL("https://kleacore.com/api/support/tickets"),
  });

  it("accepts only our own origin", () => {
    expect(isSameOriginRequest(req("https://kleacore.com") as never)).toBe(true);
    expect(isSameOriginRequest(req("https://evil.example") as never)).toBe(false);
    expect(isSameOriginRequest(req(null) as never)).toBe(false);
  });
});
