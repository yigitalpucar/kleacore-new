import type { Metadata } from "next";
import { SifremiUnuttumContent } from "./content";

export const metadata: Metadata = {
  title: "Şifremi Unuttum",
  description: "KLEACORE hesabınızın şifresini sıfırlamak için bağlantı isteyin.",
  alternates: { canonical: "/musteri/sifremi-unuttum" },
  robots: { index: false, follow: false },
};

export default function SifremiUnuttumPage() {
  return <SifremiUnuttumContent />;
}
