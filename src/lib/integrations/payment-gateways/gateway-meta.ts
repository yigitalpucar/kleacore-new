import type { GatewayMeta } from "./types";

const GATEWAY_META_PREFIX = "gateway_meta:";

export function buildGatewayNotes(prefix: string, meta: GatewayMeta) {
  return `${prefix} ${GATEWAY_META_PREFIX}${JSON.stringify(meta)}`;
}

export function parseGatewayMeta(notes: string | null | undefined): GatewayMeta | null {
  if (!notes) return null;

  const markerIndex = notes.indexOf(GATEWAY_META_PREFIX);
  if (markerIndex < 0) return null;

  const jsonPart = notes.slice(markerIndex + GATEWAY_META_PREFIX.length).trim();

  try {
    const parsed = JSON.parse(jsonPart) as GatewayMeta;
    if (
      !parsed ||
      !Array.isArray(parsed.invoiceIds) ||
      typeof parsed.customerId !== "string" ||
      typeof parsed.context !== "string" ||
      typeof parsed.provider !== "string"
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}