import type { Metadata } from "next";
import { Content } from "./content";

const description =
  "Ücretsiz WHOIS sorgulama: bir alan adının kayıt firmasını, kayıt ve bitiş tarihlerini, nameserver'larını ve durum kodlarını öğrenin.";

export const metadata: Metadata = {
  title: "WHOIS Sorgulama",
  description,
  alternates: { canonical: "/domain/whois" },
  openGraph: { title: "WHOIS Sorgulama | KLEACORE", description, url: "/domain/whois" },
};

export default function WhoisPage() {
  return <Content />;
}
