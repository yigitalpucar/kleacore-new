import type { Metadata } from "next";
import { getTurnstileSiteKey } from "@/lib/security/turnstile";
import { SifremiUnuttumContent } from "./content";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Şifremi Unuttum",
  description: "KLEACORE hesabınızın şifresini sıfırlamak için bağlantı isteyin.",
  alternates: { canonical: "/musteri/sifremi-unuttum" },
  robots: { index: false, follow: false },
};

export default async function SifremiUnuttumPage() {
  return <SifremiUnuttumContent turnstileSiteKey={await getTurnstileSiteKey()} />;
}
