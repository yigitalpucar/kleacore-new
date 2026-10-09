import type { Metadata } from "next";
import { auth } from "@/lib/auth";
import { getTurnstileSiteKey } from "@/lib/security/turnstile";
import { KvkkBasvuruContent } from "./content";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "KVKK Başvuru Formu",
  description: "6698 sayılı KVKK'nın 11. maddesi kapsamındaki haklarınız için başvuru formu.",
  alternates: { canonical: "/yasal/kvkk-basvuru" },
};

export default async function KvkkBasvuruPage() {
  const [session, turnstileSiteKey] = await Promise.all([auth(), getTurnstileSiteKey()]);
  return <KvkkBasvuruContent turnstileSiteKey={turnstileSiteKey} signedIn={Boolean(session?.user)} />;
}
