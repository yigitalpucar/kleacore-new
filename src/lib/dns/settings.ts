/**
 * DNS ownership setting (owner decision #6 is still open — docs/YOL-HARITASI.md §7).
 *
 * `dns_default_provider`:
 * - "registrar" (default, current production behaviour): DNS stays at the
 *   registrar; nothing is created at Cloudflare automatically. Domains an
 *   admin explicitly moved to Cloudflare ("Zone oluştur") still use it.
 * - "cloudflare": hosting/VDS activations create the zone + records, and
 *   customers can move their domain's DNS to Cloudflare themselves.
 */
import { db } from "@/lib/db";
import { getSettingValue } from "@/lib/integrations/settings";

export const DNS_DEFAULT_PROVIDER_SETTING = "dns_default_provider";
/** Fallback IP for hosting A records when neither the service nor its server has one. */
export const DNS_HOSTING_IP_SETTING = "dns_hosting_ip";

export const DNS_PROVIDERS = ["registrar", "cloudflare"] as const;
export type DnsDefaultProvider = (typeof DNS_PROVIDERS)[number];

export function parseDnsDefaultProvider(value: string | null | undefined): DnsDefaultProvider {
  return value?.trim().toLowerCase() === "cloudflare" ? "cloudflare" : "registrar";
}

export async function getDnsDefaultProvider(): Promise<DnsDefaultProvider> {
  return parseDnsDefaultProvider(await getSettingValue(DNS_DEFAULT_PROVIDER_SETTING, "DNS_DEFAULT_PROVIDER", "registrar"));
}

export async function saveDnsSettings(input: { provider: DnsDefaultProvider; hostingIp: string }) {
  await db.$transaction([
    db.setting.upsert({
      where: { key: DNS_DEFAULT_PROVIDER_SETTING },
      create: { key: DNS_DEFAULT_PROVIDER_SETTING, value: input.provider },
      update: { value: input.provider },
    }),
    db.setting.upsert({
      where: { key: DNS_HOSTING_IP_SETTING },
      create: { key: DNS_HOSTING_IP_SETTING, value: input.hostingIp },
      update: { value: input.hostingIp },
    }),
  ]);
}
