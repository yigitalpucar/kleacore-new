import type { Metadata } from "next";
import { getDomainTldsByCategory } from "@/lib/dal/domain-tlds";
import { BelgesizTRContent } from "./content";

export const dynamic = "force-dynamic";

const description =
  "Belge gerektirmeyen .tr uzantıları: .gen.tr, .web.tr, .name.tr ve diğerleri. Yıllık kayıt ve yenileme fiyatları KDV hariç listelenir.";

export const metadata: Metadata = {
  title: "Belgesiz .TR Alan Adı",
  description,
  alternates: { canonical: "/domain/belgesiz-tr" },
  openGraph: { title: "Belgesiz .TR Alan Adı | KLEACORE", description, url: "/domain/belgesiz-tr" },
};

const BELGELI_EXTENSIONS = new Set([".com.tr", ".net.tr", ".org.tr"]);

const TLD_DESCRIPTIONS: Record<string, string> = {
  ".gen.tr": "Genel kullanım",
  ".web.tr": "Web projeleri",
  ".tv.tr": "Medya ve yayıncılık",
  ".name.tr": "Kişisel siteler",
  ".info.tr": "Bilgi siteleri",
  ".bbs.tr": "Forum ve topluluklar",
};

export default async function BelgesizTRPage() {
  const turkiyeTlds = await getDomainTldsByCategory("Türkiye");
  const belgesizTlds = turkiyeTlds
    .filter((t) => !BELGELI_EXTENSIONS.has(t.ext))
    .map((t) => ({
      ext: t.ext,
      registerPrice: t.registerPrice,
      renewPrice: t.renewPrice,
      description: TLD_DESCRIPTIONS[t.ext] ?? "Belgesiz .tr uzantısı",
    }));

  return <BelgesizTRContent tlds={belgesizTlds} />;
}
