import { describe, expect, it } from "vitest";
import { sniffFile } from "./sniff";

const bytes = (...values: number[]) => Buffer.from(values);
const text = (value: string) => Buffer.from(value, "utf8");

describe("sniffFile (magic bytes)", () => {
  it("recognises allowed binary formats by content", () => {
    expect(sniffFile(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0))).toEqual({ ok: true, kind: "png" });
    expect(sniffFile(bytes(0xff, 0xd8, 0xff, 0xe0, 0, 0x10))).toEqual({ ok: true, kind: "jpeg" });
    expect(sniffFile(text("GIF89a......"))).toEqual({ ok: true, kind: "gif" });
    expect(sniffFile(Buffer.concat([text("RIFF"), bytes(1, 2, 3, 4), text("WEBPVP8 ")]))).toEqual({ ok: true, kind: "webp" });
    expect(sniffFile(text("%PDF-1.7\n%âãÏÓ\n"))).toEqual({ ok: true, kind: "pdf" });
    expect(sniffFile(bytes(0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1, 0))).toEqual({ ok: true, kind: "ole" });
    expect(sniffFile(Buffer.concat([text("Rar!"), bytes(0x1a, 0x07, 0x01, 0x00)]))).toEqual({ ok: true, kind: "rar" });
  });

  it("classifies ZIP containers: plain zip, OOXML, macro-enabled OOXML", () => {
    const zipHeader = bytes(0x50, 0x4b, 0x03, 0x04, 0x14, 0, 0, 0);
    expect(sniffFile(Buffer.concat([zipHeader, text("readme.txt")]))).toEqual({ ok: true, kind: "zip" });
    expect(sniffFile(Buffer.concat([zipHeader, text("[Content_Types].xml word/document.xml")]))).toEqual({ ok: true, kind: "ooxml" });
    expect(sniffFile(Buffer.concat([zipHeader, text("[Content_Types].xml word/vbaProject.bin")]))).toEqual({ ok: false, reason: "MACRO" });
  });

  it("rejects executables whatever their name", () => {
    expect(sniffFile(Buffer.concat([text("MZ"), bytes(0x90, 0, 3, 0)]))).toEqual({ ok: false, reason: "EXECUTABLE" });
    expect(sniffFile(Buffer.concat([bytes(0x7f), text("ELF"), bytes(2, 1, 1)]))).toEqual({ ok: false, reason: "EXECUTABLE" });
    expect(sniffFile(bytes(0xcf, 0xfa, 0xed, 0xfe, 7, 0, 0, 1))).toEqual({ ok: false, reason: "EXECUTABLE" });
  });

  it("rejects scripts and HTML", () => {
    expect(sniffFile(text("#!/bin/sh\nrm -rf /\n"))).toEqual({ ok: false, reason: "SCRIPT" });
    expect(sniffFile(text("<?php system($_GET['c']); ?>"))).toEqual({ ok: false, reason: "SCRIPT" });
    expect(sniffFile(text("<!DOCTYPE html><html><body>x</body></html>"))).toEqual({ ok: false, reason: "HTML" });
    expect(sniffFile(text("hello <script>alert(1)</script>"))).toEqual({ ok: false, reason: "HTML" });
  });

  it("allows plain SVG but rejects SVG with script, handlers or external links", () => {
    const clean = '<?xml version="1.0"?><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><rect width="10" height="10"/></svg>';
    expect(sniffFile(text(clean))).toEqual({ ok: true, kind: "svg" });
    expect(sniffFile(text('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'))).toEqual({ ok: false, reason: "UNSAFE_SVG" });
    expect(sniffFile(text('<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"></svg>'))).toEqual({ ok: false, reason: "UNSAFE_SVG" });
    expect(sniffFile(text('<svg><a href="javascript:alert(1)"><text>x</text></a></svg>'))).toEqual({ ok: false, reason: "UNSAFE_SVG" });
    expect(sniffFile(text('<svg><foreignObject><body/></foreignObject></svg>'))).toEqual({ ok: false, reason: "UNSAFE_SVG" });
    expect(sniffFile(text('<svg><image xlink:href="https://evil.example/x.png"/></svg>'))).toEqual({ ok: false, reason: "UNSAFE_SVG" });
  });

  it("accepts UTF-8 and Windows-1254 text, rejects binary noise and empty files", () => {
    expect(sniffFile(text("Merhaba, sunucu günlüğü:\r\nŞ ğ ı İ ö ç\n"))).toEqual({ ok: true, kind: "text" });
    expect(sniffFile(bytes(0x4d, 0x65, 0x72, 0x68, 0xfe, 0xf0, 0x0a))).toEqual({ ok: true, kind: "text" });
    expect(sniffFile(bytes(0x01, 0x02, 0x00, 0xff, 0x10))).toEqual({ ok: false, reason: "UNKNOWN" });
    expect(sniffFile(Buffer.alloc(0))).toEqual({ ok: false, reason: "EMPTY" });
  });
});
