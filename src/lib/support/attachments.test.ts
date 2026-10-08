import { describe, expect, it } from "vitest";
import {
  contentDisposition,
  legacyAttachmentNames,
  MAX_ATTACHMENT_BYTES,
  MAX_ATTACHMENTS,
  sanitizeFileName,
  validateAttachment,
  validateAttachments,
} from "./attachments";

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
const PDF = Buffer.from("%PDF-1.4\n1 0 obj\n");
const EXE = Buffer.concat([Buffer.from("MZ"), Buffer.alloc(64)]);

describe("validateAttachment", () => {
  it("accepts a file whose extension matches its content and reports the sniffed MIME type", () => {
    const result = validateAttachment({ name: "ekran.PNG", data: PNG });
    expect(result).toMatchObject({ ok: true, fileName: "ekran.PNG", mimeType: "image/png", sizeBytes: PNG.length });
    expect(result.ok && result.sha256).toMatch(/^[a-f0-9]{64}$/);
    expect(validateAttachment({ name: "fatura.pdf", data: PDF })).toMatchObject({ ok: true, mimeType: "application/pdf" });
    expect(validateAttachment({ name: "log.txt", data: Buffer.from("hata satırı\n") })).toMatchObject({ ok: true, mimeType: "text/plain" });
  });

  it("ignores the claimed type: an executable renamed to .pdf / .png is rejected", () => {
    expect(validateAttachment({ name: "fatura.pdf", data: EXE })).toMatchObject({ ok: false });
    expect(validateAttachment({ name: "resim.png", data: EXE })).toMatchObject({
      ok: false,
      error: "resim.png: çalıştırılabilir dosyalar kabul edilmiyor",
    });
  });

  it("rejects an extension that does not match the content (polyglots, disguised HTML)", () => {
    expect(validateAttachment({ name: "resim.png", data: PDF })).toMatchObject({ ok: false });
    expect(validateAttachment({ name: "notlar.txt", data: Buffer.from("<html><script>x</script></html>") })).toMatchObject({ ok: false });
    expect(validateAttachment({ name: "script.js", data: Buffer.from("console.log(1)") })).toMatchObject({ ok: false });
    expect(validateAttachment({ name: "noext", data: PDF })).toMatchObject({ ok: false, error: "noext: dosya uzantısı yok" });
  });

  it("enforces the size limit and the file count", () => {
    const big = Buffer.concat([PDF, Buffer.alloc(MAX_ATTACHMENT_BYTES)]);
    expect(validateAttachment({ name: "buyuk.pdf", data: big })).toMatchObject({ ok: false, error: "buyuk.pdf: 10 MB sınırını aşıyor" });
    const many = Array.from({ length: MAX_ATTACHMENTS + 1 }, (_, i) => ({ name: `${i}.pdf`, data: PDF }));
    expect(validateAttachments(many)).toEqual({ ok: false, error: `En fazla ${MAX_ATTACHMENTS} dosya ekleyebilirsiniz.` });
    expect(validateAttachments(many.slice(0, MAX_ATTACHMENTS))).toMatchObject({ ok: true });
    expect(validateAttachments([{ name: "a.pdf", data: PDF }, { name: "b.exe", data: EXE }])).toMatchObject({ ok: false });
  });
});

describe("file names", () => {
  it("strips directories, control and bidi characters (display only)", () => {
    expect(sanitizeFileName("../../etc/passwd")).toBe("passwd");
    expect(sanitizeFileName("C:\\Users\\x\\rapor.pdf")).toBe("rapor.pdf");
    expect(sanitizeFileName("fatura\u202Efdp.exe")).toBe("faturafdp.exe");
    expect(sanitizeFileName('a"b<c>.txt')).toBe("abc.txt");
    expect(sanitizeFileName("...")).toBe("dosya");
    expect(sanitizeFileName("x".repeat(300) + ".pdf")).toHaveLength(180);
  });

  it("builds an attachment Content-Disposition with ASCII fallback and UTF-8 name", () => {
    expect(contentDisposition("Şirket raporu.pdf")).toBe(
      `attachment; filename="_irket raporu.pdf"; filename*=UTF-8''%C5%9Eirket%20raporu.pdf`
    );
  });

  it("reads legacy name-only attachment JSON", () => {
    expect(legacyAttachmentNames([{ name: "eski.png", size: "1 KB", type: "image" }, { foo: 1 }, null])).toEqual(["eski.png"]);
    expect(legacyAttachmentNames("x")).toEqual([]);
  });
});
