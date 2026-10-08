import type { Metadata } from "next";
import { GirisContent, type AuthMode } from "./content";

export const metadata: Metadata = {
  title: "Giriş Yap veya Kayıt Ol",
  description: "KLEACORE müşteri paneline giriş yapın veya yeni bir hesap oluşturun.",
  alternates: { canonical: "/musteri/giris" },
  robots: { index: false, follow: false },
};

/** `?mod=kayit` opens the register tab (header "Kayıt Ol" links use it). */
function parseMode(value: string | string[] | undefined): AuthMode {
  const mode = Array.isArray(value) ? value[0] : value;
  return mode === "kayit" || mode === "kayıt" || mode === "register" ? "register" : "login";
}

export default async function GirisPage({
  searchParams,
}: {
  searchParams: Promise<{ mod?: string | string[] }>;
}) {
  const { mod } = await searchParams;
  return <GirisContent initialMode={parseMode(mod)} />;
}
