import { NextResponse } from "next/server";
import { createLogger } from "@/lib/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const log = createLogger("csp");
const MAX_BODY_BYTES = 8 * 1024;
const MAX_FIELD_LENGTH = 300;

function clip(value: unknown) {
  return typeof value === "string" ? value.slice(0, MAX_FIELD_LENGTH) : undefined;
}

/**
 * Receives Content-Security-Policy-Report-Only violation reports
 * (legacy `application/csp-report` format) and logs a trimmed summary.
 * Always answers 204 so browsers don't retry; never echoes input.
 */
export async function POST(request: Request) {
  try {
    const raw = await request.text();
    if (raw.length > MAX_BODY_BYTES) {
      return new NextResponse(null, { status: 204 });
    }
    const body = JSON.parse(raw) as { "csp-report"?: Record<string, unknown> };
    const report = body["csp-report"];
    if (report && typeof report === "object") {
      log.warn("csp violation", {
        documentUri: clip(report["document-uri"]),
        violatedDirective: clip(report["violated-directive"] ?? report["effective-directive"]),
        blockedUri: clip(report["blocked-uri"]),
        sourceFile: clip(report["source-file"]),
        lineNumber: typeof report["line-number"] === "number" ? report["line-number"] : undefined,
      });
    }
  } catch {
    // Malformed reports are noise from browsers/bots; ignore them.
  }
  return new NextResponse(null, { status: 204 });
}
