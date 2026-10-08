import { FileText, Globe, MailWarning, Network, Route, ShieldCheck } from "lucide-react";
import type { FeatureItem } from "@/components/site/feature-grid";
import { Section } from "@/components/site/section";
import { SectionHeading } from "@/components/site/section-heading";
import type { ProductWithPricing } from "@/lib/products/map-product";
import { CartPlanGrid } from "@/components/site/sunucu/cart-plan-grid";
import { CartPlanTable, type CartPlanRow } from "@/components/site/sunucu/cart-plan-table";
import { DcLanding } from "@/components/site/sunucu/dc-landing";
import { dcFaqs, productToDcCard } from "@/components/site/sunucu/dc-catalog";
import { isUnverifiedClaim } from "@/components/site/sunucu/server-catalog";

type Res = Record<string, string | undefined>;
const res = (p: ProductWithPricing) => (p.resourceLimits as unknown as Res | null) ?? {};

function toIpRow(p: ProductWithPricing): CartPlanRow {
  const monthly = p.pricingTiers.find((t) => t.period === "monthly");
  const extras = ((p.includedFeatures as unknown as string[] | null) ?? []).filter(
    (f) => !isUnverifiedClaim(f) && !/ripe|hemen teslim|ptr|abuse/i.test(f)
  );
  return {
    id: p.sku,
    name: p.name,
    featured: p.isPopular,
    specs: {
      block: res(p).block ?? "",
      ips: res(p).ips ?? "",
      extras: extras.length ? extras.join(", ") : "—",
    },
    monthlyPrice: monthly?.discountedPrice ?? monthly?.price ?? p.basePrice,
    yearlyMonthlyPrice: null,
  };
}

const features: FeatureItem[] = [
  { icon: ShieldCheck, title: "RIPE kayıtlı", description: "Tüm IPv4 blokları RIPE veritabanında kayıtlıdır." },
  { icon: Globe, title: "Kara liste kontrolü", description: "Bloklar teslimden önce kara liste kontrolünden geçirilir." },
  { icon: Network, title: "PTR yönetimi", description: "Ters DNS (PTR) kayıtlarınızı kendiniz yönetirsiniz." },
  { icon: MailWarning, title: "Abuse yönetimi", description: "Kötüye kullanım bildirimleri kayıtlı iletişim üzerinden yönetilir." },
  { icon: Route, title: "BGP session desteği", description: "ASN hizmetleriyle IP bloklarınızı kendi ASN'iniz üzerinden duyurabilirsiniz." },
  { icon: FileText, title: "LOA belgesi", description: "ASN paketlerinde yetkilendirme (LOA) belgesi dahildir." },
];

export function Content({ products }: { products: ProductWithPricing[] }) {
  const ipv4 = products.filter((p) => res(p).block !== undefined && res(p).asn === undefined);
  const asn = products.filter((p) => res(p).asn !== undefined);

  return (
    <DcLanding
      service="ip-asn"
      eyebrow="RIPE kayıtlı"
      title="IPv4 ve ASN Kiralama"
      description="Sunucularınız, VPN ve CDN altyapınız için RIPE kayıtlı IPv4 blokları; kendi ağınızı duyurmak için ASN ve BGP desteği."
      breadcrumb="IPv4 ve ASN"
      trustItems={[
        { icon: ShieldCheck, label: "RIPE kayıtlı", description: "Tüm bloklar" },
        { icon: Network, label: "PTR yönetimi", description: "Ters DNS" },
        { icon: MailWarning, label: "Abuse yönetimi", description: "Tüm bloklarda" },
        { icon: Route, label: "BGP session", description: "ASN hizmetlerinde" },
        { icon: FileText, label: "LOA belgesi", description: "ASN hizmetlerinde" },
      ]}
      featuresTitle="IP ve ASN hizmetlerinde neler var?"
      features={features}
      faqs={dcFaqs(products)}
      faqDescription="IPv4 ve ASN kiralama hakkında merak edilenler."
      cta={{
        title: "Daha büyük bir bloğa mı ihtiyacınız var?",
        description: "/25, /24 ve daha büyük bloklar için bize yazın; ihtiyacınıza göre fiyatlandırma yapalım.",
      }}
    >
      <Section divider aria-labelledby="ipv4-heading">
        <SectionHeading
          id="ipv4-heading"
          align="center"
          eyebrow="IPv4 blokları"
          title="IPv4 bloğunuzu seçin"
          description="Bloklar kullanılabilir IP sayısına göre ayrılır. Tüm bloklarda RIPE kaydı, PTR ve abuse yönetimi dahildir. Fiyatlar aylıktır."
          className="mb-10"
        />
        <CartPlanTable
          plans={ipv4.map(toIpRow)}
          columns={[
            { key: "block", label: "Blok" },
            { key: "ips", label: "Kullanılabilir IP" },
            { key: "extras", label: "Ek olarak" },
          ]}
          target={{ kind: "datacenter", subType: "ip-asn" }}
          caption="IPv4 blokları"
          ctaLabel="Kirala"
          showBillingSwitch={false}
        />
      </Section>

      {asn.length > 0 ? (
        <Section tone="muted" divider aria-labelledby="asn-heading">
          <SectionHeading
            id="asn-heading"
            align="center"
            eyebrow="ASN hizmetleri"
            title="Kendi ağınızı duyurun"
            description="ASN (otonom sistem numarası) ile IP bloklarınızı BGP üzerinden kendi ağınız olarak duyurursunuz."
            className="mb-12"
          />
          <CartPlanGrid plans={asn.map(productToDcCard)} subType="ip-asn" ctaLabel="Hemen başla" />
        </Section>
      ) : null}
    </DcLanding>
  );
}
