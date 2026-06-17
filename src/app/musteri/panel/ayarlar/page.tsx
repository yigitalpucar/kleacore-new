import { auth } from "@/lib/auth";
import { getUserProfile, getApiKeysByUser } from "@/lib/dal/settings";
import { AyarlarContent } from "./content";

export const dynamic = "force-dynamic";

function maskApiKey(key: string): string {
  if (key.length <= 8) return "****";
  return key.substring(0, 7) + "****" + key.substring(key.length - 4);
}

export default async function AyarlarPage() {
  const session = await auth();
  const userId = session!.user.id;

  const [profile, apiKeys] = await Promise.all([
    getUserProfile(userId),
    getApiKeysByUser(userId),
  ]);

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
    <AyarlarContent profile={serializedProfile} apiKeys={serializedApiKeys} />
  );
}
