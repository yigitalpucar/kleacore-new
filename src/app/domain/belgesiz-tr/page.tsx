import { Topbar } from "@/components/layout/topbar";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { getDomainTldsByCategory } from "@/lib/dal/domain-tlds";
import { BelgesizTRContent } from "./content";

const BELGELI_EXTENSIONS = new Set([".com.tr", ".net.tr", ".org.tr"]);

const TLD_DESCRIPTIONS: Record<string, string> = {
  ".gen.tr": "Genel kullanım",
  ".web.tr": "Web projeleri için",
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
      description: TLD_DESCRIPTIONS[t.ext] ?? "Belgesiz .TR uzantısı",
    }));

  return (
    <div className="flex min-h-screen flex-col">
      <Topbar />
      <Header />
      <BelgesizTRContent tlds={belgesizTlds} />
      <Footer />
    </div>
  );
}
