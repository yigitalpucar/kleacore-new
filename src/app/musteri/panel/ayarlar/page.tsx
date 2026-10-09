import type { Metadata } from "next";
import { auth } from "@/lib/auth";
import { isTwoFactorGloballyEnabled } from "@/lib/auth/two-factor-settings";
import { getUserProfile, getApiKeysByUser } from "@/lib/dal/settings";
import { getSecurityOverview } from "@/lib/dal/privacy";
import { getRequestMeta } from "@/lib/request-meta";
import { deviceFingerprint, networkLabel } from "@/lib/security/device";
import { AyarlarContent } from "./content";
import type { SecurityOverviewData } from "./security-activity";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Hesap ayarları" };

function maskApiKey(key: string): string {
  if (key.length <= 8) return "****";
  return key.substring(0, 7) + "****" + key.substring(key.length - 4);
}

export default async function AyarlarPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { "2fa": twoFactorNotice, sekme } = await searchParams;
  const session = await auth();
  const userId = session!.user.id;

  const [profile, apiKeys, twoFactorGloballyEnabled, overview, meta] = await Promise.all([
    getUserProfile(userId),
    getApiKeysByUser(userId),
    isTwoFactorGloballyEnabled(),
    getSecurityOverview(userId),
    getRequestMeta(),
  ]);

  const currentDevice = deviceFingerprint(meta).deviceHash;
  const security: SecurityOverviewData = {
    recentLogins: (overview?.recentLogins ?? []).map((row) => ({
      id: row.id,
      createdAt: row.createdAt.toISOString(),
      success: row.success,
      reason: row.reason,
      method: row.method,
      twoFactorUsed: row.twoFactorUsed,
      device: row.uaFamily ?? "Bilinmeyen tarayıcı",
      ipAddress: row.ipAddress,
      network: networkLabel(row.network),
      newDevice: row.newDevice,
    })),
    sessions: (overview?.sessions ?? []).map((row, index, all) => ({
      id: row.id,
      createdAt: row.createdAt.toISOString(),
      device: row.uaFamily ?? "Bilinmeyen tarayıcı",
      ipAddress: row.ipAddress,
      network: networkLabel(row.network),
      // Newest session from this browser + network is (most likely) this one.
      current: row.deviceHash === currentDevice && all.findIndex((other) => other.deviceHash === currentDevice) === index,
    })),
    devices: (overview?.devices ?? []).map((device) => ({
      id: device.id,
      label: device.label,
      ipAddress: device.ipAddress,
      createdAt: device.createdAt.toISOString(),
      lastUsedAt: device.lastUsedAt?.toISOString() ?? null,
      expiresAt: device.expiresAt.toISOString(),
    })),
  };

  const serializedProfile = profile
    ? {
        name: profile.name,
        surname: profile.surname,
        email: profile.email,
        phone: profile.phone ?? "",
        companyName: profile.companyName ?? "",
        taxNumber: profile.taxNumber ?? "",
        taxOffice: profile.taxOffice ?? "",
        address: profile.address ?? "",
        city: profile.city ?? "",
        country: profile.country,
      }
    : null;

  const serializedApiKeys = apiKeys.map((k) => ({
    id: k.id,
    name: k.name,
    key: maskApiKey(k.keyPrefix),
    createdAt: k.createdAt.toISOString(),
    lastUsedAt: k.lastUsedAt ? k.lastUsedAt.toISOString() : null,
  }));

  return (
    <AyarlarContent
      profile={serializedProfile}
      apiKeys={serializedApiKeys}
      twoFactorEnabled={profile?.twoFactorEnabled ?? false}
      twoFactorSetupPending={
        !profile?.twoFactorEnabled && Boolean(profile?.twoFactorSecret)
      }
      twoFactorGloballyEnabled={twoFactorGloballyEnabled}
      staffTwoFactorRequired={twoFactorNotice === "personel" && !profile?.twoFactorEnabled}
      initialTab={sekme === "guvenlik" ? "security" : undefined}
      security={security}
    />
  );
}
