import { describe, expect, it, vi } from "vitest";
import type { StorageDriver } from "@/lib/storage";
import { KYC_MAX_FILE_BYTES, storeKycFiles, validateKycFile, validateKycSubmission } from "./documents";

const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(64, 1)]);
const jpeg = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(64, 2)]);
const pdf = Buffer.from("%PDF-1.7\n1 0 obj\n<<>>\nendobj\n");
const exe = Buffer.concat([Buffer.from("MZ"), Buffer.alloc(64)]);
const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><rect/></svg>');
const html = Buffer.from("<!doctype html><html><script>alert(1)</script></html>");
const zip = Buffer.concat([Buffer.from([0x50, 0x4b, 0x03, 0x04]), Buffer.alloc(40)]);

describe("validateKycFile", () => {
  it("accepts JPG, PNG, WEBP and PDF detected from content with a matching extension", () => {
    expect(validateKycFile({ type: "IDENTITY_FRONT", name: "on.jpg", data: jpeg })).toMatchObject({ ok: true, file: { mimeType: "image/jpeg" } });
    expect(validateKycFile({ type: "IDENTITY_BACK", name: "arka.PNG", data: png })).toMatchObject({ ok: true, file: { mimeType: "image/png" } });
    const result = validateKycFile({ type: "TAX_CERTIFICATE", name: "../../levha.pdf", data: pdf });
    expect(result).toMatchObject({ ok: true, file: { mimeType: "application/pdf", fileName: "levha.pdf", sizeBytes: pdf.length } });
    expect(result.ok && result.file.sha256).toMatch(/^[0-9a-f]{64}$/);
  });

  it("rejects executables, SVG, HTML, archives and anything not an image/PDF", () => {
    for (const [name, data] of [
      ["kimlik.jpg", exe],
      ["kimlik.svg", svg],
      ["kimlik.html", html],
      ["kimlik.zip", zip],
      ["kimlik.txt", Buffer.from("plain text")],
    ] as const) {
      expect(validateKycFile({ type: "IDENTITY_FRONT", name, data })).toMatchObject({ ok: false });
    }
  });

  it("rejects a renamed file (extension must match the content)", () => {
    expect(validateKycFile({ type: "IDENTITY_FRONT", name: "kimlik.pdf", data: png })).toMatchObject({
      ok: false,
      error: expect.stringContaining("uzantısı"),
    });
  });

  it("enforces the size limit, empty files and the document type", () => {
    const big = Buffer.concat([png, Buffer.alloc(KYC_MAX_FILE_BYTES)]);
    expect(validateKycFile({ type: "IDENTITY_FRONT", name: "a.png", data: big })).toMatchObject({ ok: false, error: expect.stringContaining("8 MB") });
    expect(validateKycFile({ type: "IDENTITY_FRONT", name: "a.png", data: Buffer.alloc(0) })).toMatchObject({ ok: false });
    expect(validateKycFile({ type: "PASSPORT", name: "a.png", data: png })).toMatchObject({ ok: false, error: "Geçersiz belge türü." });
  });
});

describe("validateKycSubmission", () => {
  const front = { type: "IDENTITY_FRONT", name: "on.jpg", data: jpeg };
  const back = { type: "IDENTITY_BACK", name: "arka.jpg", data: jpeg };
  const tax = { type: "TAX_CERTIFICATE", name: "levha.pdf", data: pdf };
  const selfie = { type: "SELFIE", name: "selfie.png", data: png };

  it("needs both identity sides (selfie optional)", () => {
    expect(validateKycSubmission([front, back], "INDIVIDUAL").ok).toBe(true);
    expect(validateKycSubmission([front, back, selfie], "INDIVIDUAL").ok).toBe(true);
    expect(validateKycSubmission([front], "INDIVIDUAL")).toMatchObject({ ok: false, error: expect.stringContaining("ön ve arka") });
    expect(validateKycSubmission([selfie], "INDIVIDUAL").ok).toBe(false);
    expect(validateKycSubmission([], "INDIVIDUAL").ok).toBe(false);
  });

  it("accepts the tax certificate only for corporate accounts", () => {
    expect(validateKycSubmission([tax], "CORPORATE").ok).toBe(true);
    expect(validateKycSubmission([front, back], "CORPORATE").ok).toBe(true);
    expect(validateKycSubmission([tax], "INDIVIDUAL")).toMatchObject({ ok: false, error: expect.stringContaining("kurumsal") });
  });

  it("allows one file per type and fails on the first invalid file", () => {
    expect(validateKycSubmission([front, front, back], "INDIVIDUAL")).toMatchObject({ ok: false, error: expect.stringContaining("tek dosya") });
    expect(validateKycSubmission([front, { ...back, data: exe }], "INDIVIDUAL").ok).toBe(false);
  });
});

describe("storeKycFiles", () => {
  it("writes under fresh private kyc/ keys and removes written files when one fails", async () => {
    const put = vi.fn().mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error("disk full"));
    const remove = vi.fn();
    const driver = { name: "local", put, get: vi.fn(), delete: remove } as unknown as StorageDriver;
    const files = validateKycSubmission(
      [
        { type: "IDENTITY_FRONT", name: "on.jpg", data: jpeg },
        { type: "IDENTITY_BACK", name: "arka.jpg", data: jpeg },
      ],
      "INDIVIDUAL"
    );
    if (!files.ok) throw new Error("fixture");

    await expect(storeKycFiles(files.files, driver)).rejects.toThrow("disk full");
    const firstKey = put.mock.calls[0][0] as string;
    expect(firstKey).toMatch(/^kyc\/\d{4}\/\d{2}\/[0-9a-f-]{36}$/);
    expect(remove).toHaveBeenCalledWith(firstKey);
  });
});
