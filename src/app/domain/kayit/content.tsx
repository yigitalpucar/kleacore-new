import { Globe, Headphones, KeyRound, Network, RefreshCw, Server } from "lucide-react";
import { Topbar } from "@/components/layout/topbar";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { DomainSearch } from "@/components/domain/domain-search";
import {
  CtaBand,
  FaqSection,
  FeatureGrid,
  PageHeader,
  Section,
  SectionHeading,
  TrustBar,
  type FaqItem,
  type FeatureItem,
  type TrustBarItem,
} from "@/components/site";
import { TldPriceTable, type TldPriceRow } from "@/components/site/domain/tld-price-table";

const trustItems: TrustBarItem[] = [
  { icon: Globe, label: "Popüler uzantılar", description: ".com, .net, .com.tr ve diğerleri" },
  { icon: Network, label: "DNS yönetimi", description: "Müşteri panelinden" },
  { icon: KeyRound, label: "Kolay transfer", description: "EPP/transfer kodu ile" },
  { icon: Headphones, label: "7/24 Destek", description: "Destek talebi ve e-posta" },
];

const features: FeatureItem[] = [
  {
    icon: Network,
    title: "DNS kayıt yönetimi",
    description: "A, CNAME, MX ve TXT gibi DNS kayıtlarını müşteri panelinden ekleyin, düzenleyin veya silin.",
  },
  {
    icon: Server,
    title: "Nameserver değişikliği",
    description: "Alan adınızı KLEACORE hosting'e ya da dilediğiniz başka bir sağlayıcıya yönlendirmek için nameserver'ları güncelleyin.",
  },
  {
    icon: RefreshCw,
    title: "Yenileme takibi",
    description: "Alan adlarınızın bitiş tarihlerini ve otomatik yenileme durumunu müşteri panelinden izleyin.",
  },
  {
    icon: KeyRound,
    title: "EPP kodu talebi",
    description: "Alan adınızı başka bir firmaya taşımak isterseniz transfer kodunu panel üzerinden talep edebilirsiniz.",
  },
];

const faqs: FaqItem[] = [
  {
    question: "Sorgu sonucunda neden \"müsait\" yazmıyor?",
    answer:
      "Arama sonuçları bir ön sorgudur. Kayıtlı olduğu tespit edilen alan adlarını \"Kayıtlı\" olarak işaretleriz. Diğer alan adlarının kesin müsaitliği sipariş aşamasında kayıt kuruluşu üzerinden doğrulanır. Emin olmak için WHOIS sorgusu da yapabilirsiniz.",
  },
  {
    question: "Alan adı kaydı ne kadar sürer?",
    answer:
      "Ödemeniz onaylandıktan sonra kayıt işlemi başlatılır. Genel uzantılarda kayıt genellikle kısa sürede tamamlanır; .tr uzantılarında TRABİS kuralları gereği ek doğrulama gerekebilir.",
  },
  {
    question: "Kayıt fiyatı ile yenileme fiyatı neden farklı?",
    answer:
      "Bazı uzantılarda ilk yıl kayıt ücreti, sonraki yılların yenileme ücretinden düşüktür. Fiyat listesinde her uzantı için kayıt, yenileme ve transfer ücretlerini ayrı ayrı gösteriyoruz.",
  },
  {
    question: "Alan adımı başka bir firmadan taşıyabilir miyim?",
    answer:
      "Evet. Mevcut firmanızdan transfer kilidini kaldırıp EPP/Auth kodunu alın, ardından Domain Transferi sayfasından talebinizi oluşturun.",
  },
  {
    question: "Alan adımın süresi dolarsa ne olur?",
    answer:
      "Süresi dolan alan adı çalışmayı durdurur ve uzantıya göre değişen bir ek süre içinde yenilenebilir. Ek süre sonunda alan adı yeniden kayda açılabilir; bu yüzden süresi dolmadan yenilemenizi öneririz.",
  },
  {
    question: "Fiyatlara KDV dahil mi?",
    answer: "Hayır. Gösterilen fiyatlara KDV dahil değildir; %20 KDV ödeme adımında eklenir.",
  },
];

export function Content({ tlds }: { tlds: TldPriceRow[] }) {
  const searchTlds = tlds.slice(0, 12).map((tld) => ({
    ext: tld.ext,
    price: tld.registerPrice,
    renewPrice: tld.renewPrice,
  }));

  return (
    <div className="flex min-h-screen flex-col">
      <Topbar />
      <Header />
      <main id="main" className="flex-1">
        <PageHeader
          eyebrow="Alan adı"
          title="Alan adı kaydı"
          description={`Markanıza uygun alan adını arayın. ${tlds.length} uzantıda kayıt, yenileme ve transfer fiyatlarını KDV hariç açıkça listeliyoruz.`}
          breadcrumbs={[{ label: "Domain" }, { label: "Alan adı kaydı" }]}
        >
          <div id="alan-adi-ara" className="mx-auto max-w-3xl scroll-mt-24">
            <DomainSearch tlds={searchTlds} />
          </div>
        </PageHeader>

        <TrustBar items={trustItems} bordered={false} />

        <Section id="fiyatlar" tone="muted" divider aria-labelledby="fiyatlar-baslik">
          <SectionHeading
            id="fiyatlar-baslik"
            eyebrow="Fiyat listesi"
            title="Uzantı fiyatları"
            description="Kayıt, yenileme ve transfer ücretleri uzantıya göre değişir. Bazı uzantılarda yenileme ücreti ilk yıl kayıt ücretinden yüksektir; karar vermeden önce iki sütunu birlikte inceleyin."
            className="mb-10"
          />
          <TldPriceTable tlds={tlds} />
        </Section>

        <Section divider>
          <SectionHeading
            eyebrow="Panel"
            title="Alan adınızı tek yerden yönetin"
            description="Kayıttan sonra alan adınızın DNS, nameserver ve yenileme işlemlerini müşteri panelinden yaparsınız."
            className="mb-12"
          />
          <FeatureGrid items={features} columns={4} />
        </Section>

        <FaqSection
          items={faqs}
          title="Alan adı kaydı hakkında sorular"
          description="Kayıt, yenileme ve fiyatlandırma hakkında merak edilenler."
          tone="muted"
          divider
        />

        <CtaBand
          eyebrow="Sonraki adım"
          title="Alan adınız hazır mı? Şimdi barındırın."
          description="Linux hosting paketlerinde cPanel, LiteSpeed ve ücretsiz Let's Encrypt SSL bulunur. Alan adınız başka bir firmadaysa transferle taşıyabilirsiniz."
          primary={{ label: "Hosting paketleri", href: "/hosting/linux" }}
          secondary={{ label: "Domain transferi", href: "/domain/transfer" }}
        />
      </main>
      <Footer />
    </div>
  );
}
