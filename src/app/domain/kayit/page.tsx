import type { Metadata } from "next";
import { getDomainTlds } from "@/lib/dal/domain-tlds";
import { Content } from "./content";

export const dynamic = "force-dynamic";

const description =
  "Alan adı sorgulayın ve kaydedin. .com, .com.tr ve diğer uzantılarda kayıt, yenileme ve transfer fiyatlarını KDV hariç açıkça görün.";

export const metadata: Metadata = {
  title: "Alan Adı Kaydı ve Domain Sorgulama",
  description,
  alternates: { canonical: "/domain/kayit" },
  openGraph: {
    title: "Alan Adı Kaydı ve Domain Sorgulama | KLEACORE",
    description,
    url: "/domain/kayit",
  },
};

export default async function DomainKayitPage() {
  const tlds = await getDomainTlds();

  return (
    <Content
      tlds={tlds.map((tld) => ({
        ext: tld.ext,
        category: tld.category,
        registerPrice: tld.registerPrice,
        renewPrice: tld.renewPrice,
        transferPrice: tld.transferPrice,
      }))}
    />
  );
}
