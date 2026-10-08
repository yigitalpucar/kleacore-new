/**
 * File type detection from content (magic bytes), never from the client's
 * Content-Type or the file name. Anything not positively recognised as one
 * of the allowed kinds is rejected; executables and scripts are named
 * explicitly so the error message can say so.
 */

export type SniffedKind =
  | "png"
  | "jpeg"
  | "gif"
  | "webp"
  | "pdf"
  | "zip"
  | "ooxml"
  | "odf"
  | "ole"
  | "rar"
  | "7z"
  | "svg"
  | "text";

export type SniffResult =
  | { ok: true; kind: SniffedKind }
  | { ok: false; reason: "EXECUTABLE" | "SCRIPT" | "UNSAFE_SVG" | "HTML" | "MACRO" | "UNKNOWN" | "EMPTY" };

function startsWith(data: Buffer, bytes: number[], offset = 0) {
  if (data.length < offset + bytes.length) return false;
  for (let i = 0; i < bytes.length; i++) if (data[offset + i] !== bytes[i]) return false;
  return true;
}

function ascii(data: Buffer, start: number, end: number) {
  return data.subarray(start, Math.min(end, data.length)).toString("latin1");
}

const EXECUTABLE_SIGNATURES: number[][] = [
  [0x4d, 0x5a], // MZ — Windows PE / DOS
  [0x7f, 0x45, 0x4c, 0x46], // ELF
  [0xfe, 0xed, 0xfa, 0xce], // Mach-O 32
  [0xfe, 0xed, 0xfa, 0xcf], // Mach-O 64
  [0xce, 0xfa, 0xed, 0xfe],
  [0xcf, 0xfa, 0xed, 0xfe],
  [0xca, 0xfe, 0xba, 0xbe], // Mach-O fat / Java class
  [0x00, 0x61, 0x73, 0x6d], // WebAssembly
];

/** Valid UTF-8 with no NUL / unusual control characters (BOM allowed). */
function isPlainText(data: Buffer) {
  const sample = data.subarray(0, 64 * 1024);
  for (const byte of sample) {
    if (byte === 0) return false;
    if (byte < 0x20 && byte !== 0x09 && byte !== 0x0a && byte !== 0x0d && byte !== 0x0c && byte !== 0x1b) return false;
  }
  try {
    new TextDecoder("utf-8", { fatal: true }).decode(data);
    return true;
  } catch {
    // Windows-1254 / Latin-5 text from older Turkish systems: no C1 controls.
    return !sample.some((byte) => byte >= 0x80 && byte < 0xa0 && ![0x80, 0x8a, 0x8c, 0x9a, 0x9c, 0x9f].includes(byte));
  }
}

const SVG_DANGER =
  /<script|<foreignobject|<iframe|<embed|<object|<handler|<listener|\bon[a-z]+\s*=|javascript:|vbscript:|data:text\/html|<!entity|xlink:href\s*=\s*["']?\s*(?!#)|href\s*=\s*["']?\s*(?!#)[a-z]+:/i;

function textKind(data: Buffer): SniffResult {
  const head = data.subarray(0, 4096).toString("utf8").replace(/^﻿/, "").trimStart().toLowerCase();
  if (head.startsWith("#!")) return { ok: false, reason: "SCRIPT" };
  if (/<svg[\s>]/.test(head) && (head.startsWith("<svg") || head.startsWith("<?xml") || head.startsWith("<!--") || head.startsWith("<!doctype svg"))) {
    const whole = data.toString("utf8");
    return SVG_DANGER.test(whole) ? { ok: false, reason: "UNSAFE_SVG" } : { ok: true, kind: "svg" };
  }
  if (/^<!doctype html|^<html|<script[\s>]|<iframe[\s>]/.test(head)) return { ok: false, reason: "HTML" };
  if (/^<\?php|^@echo off|^#!/.test(head)) return { ok: false, reason: "SCRIPT" };
  return { ok: true, kind: "text" };
}

/** Names stored in a ZIP's local/central headers are plain ASCII; good enough to classify OOXML / ODF. */
function zipKind(data: Buffer): SniffResult {
  const names = data.toString("latin1");
  if (names.includes("vbaProject.bin")) return { ok: false, reason: "MACRO" };
  if (names.includes("[Content_Types].xml")) return { ok: true, kind: "ooxml" };
  if (ascii(data, 30, 38) === "mimetype" && ascii(data, 38, 85).startsWith("application/vnd.oasis.opendocument")) {
    return { ok: true, kind: "odf" };
  }
  return { ok: true, kind: "zip" };
}

export function sniffFile(data: Buffer): SniffResult {
  if (data.length === 0) return { ok: false, reason: "EMPTY" };

  for (const signature of EXECUTABLE_SIGNATURES) {
    if (startsWith(data, signature)) return { ok: false, reason: "EXECUTABLE" };
  }

  if (startsWith(data, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return { ok: true, kind: "png" };
  if (startsWith(data, [0xff, 0xd8, 0xff])) return { ok: true, kind: "jpeg" };
  if (ascii(data, 0, 6) === "GIF87a" || ascii(data, 0, 6) === "GIF89a") return { ok: true, kind: "gif" };
  if (ascii(data, 0, 4) === "RIFF" && ascii(data, 8, 12) === "WEBP") return { ok: true, kind: "webp" };
  if (ascii(data, 0, 5) === "%PDF-") return { ok: true, kind: "pdf" };
  if (startsWith(data, [0x50, 0x4b, 0x03, 0x04]) || startsWith(data, [0x50, 0x4b, 0x05, 0x06])) return zipKind(data);
  if (startsWith(data, [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1])) return { ok: true, kind: "ole" };
  if (startsWith(data, [0x52, 0x61, 0x72, 0x21, 0x1a, 0x07])) return { ok: true, kind: "rar" };
  if (startsWith(data, [0x37, 0x7a, 0xbc, 0xaf, 0x27, 0x1c])) return { ok: true, kind: "7z" };

  if (isPlainText(data)) return textKind(data);
  return { ok: false, reason: "UNKNOWN" };
}
