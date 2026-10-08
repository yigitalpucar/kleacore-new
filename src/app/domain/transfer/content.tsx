import { Globe, Headphones, KeyRound, Network } from "lucide-react";
import { Topbar } from "@/components/layout/topbar";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { DomainTransferForm } from "@/components/domain/domain-transfer-form";
import {
  CtaBand,
  FaqSection,
  PageHeader,
  Section,
  SectionHeading,
  TrustBar,
  type FaqItem,
  type TrustBarItem,
} from "@/components/site";
import { StepList, type StepItem } from "@/components/site/domain/step-list";
import { TldPriceTable, type TldPriceRow } from "@/components/site/domain/tld-price-table";

const trustItems: TrustBarItem[] = [
  { icon: KeyRound, label: "EPP ile transfer", description: "Transfer kodu yeterli" },
  { icon: Network, label: "DNS yönetimi", description: "Müşteri panelinden" },
  { icon: Globe, label: "Popüler uzantılar", description: ".com, .net, .com.tr ve diğerleri" },
  { icon: Headphones, label: "7/24 Destek", description: "Destek talebi ve e-posta" },
];

const steps: StepItem[] = [
  {
    title: "Kilidi kaldırın, kodu alın",
    description:
      "Mevcut firmanızın panelinden transfer kilidini kaldırın ve EPP/Auth kodunu alın. Alan adının son 60 gün içinde kaydedilmemiş veya transfer edilmemiş olması gerekir.",
  },
  {
    title: "Talebi oluşturun",
    description: "Alan adınızı, EPP kodunu ve iletişim e-postanızı forma girin. Transfer ücreti uzantıya göre değişir.",
  },
  {
    title: "Onaylayın",
    description:
      "Kayıt kuruluşu, alan adı sahibinin e-posta adresine onay isteği gönderebilir. Onayı vermeniz süreci hızlandırır.",
  },
  {
    title: "Transfer tamamlanır",
    description:
      "Genel uzantılarda transfer genellikle 5–7 gün sürer. Tamamlandığında alan adınızı müşteri panelinden yönetirsiniz.",
  },
];

const faqs: FaqItem[] = [
  {
    question: "Transfer ne kadar sürer?",
    answer:
      ".com, .net, .org gibi genel uzantılarda transfer genellikle 5–7 gün sürer. Onay e-postasını hızlı onaylamanız süreyi kısaltabilir. .tr uzantılarında süre TRABİS işlemlerine bağlıdır.",
  },
  {
    question: "EPP/Auth kodu nedir, nereden alırım?",
    answer:
      "EPP kodu, alan adının transferini yetkilendiren güvenlik kodudur. Mevcut kayıt firmanızın kontrol panelinden veya destek ekibinden talep edebilirsiniz. Kod olmadan transfer başlatılamaz.",
  },
  {
    question: "Transfer ücreti ne kadar?",
    answer:
      "Transfer ücreti uzantıya göre değişir ve bu sayfadaki fiyat listesinde yazar. Genel uzantılarda (.com, .net vb.) transfer, kayıt kuruluşu kuralları gereği alan adınızın süresine genellikle 1 yıl ekler.",
  },
  {
    question: "Transfer sırasında sitem ve e-postam çalışır mı?",
    answer:
      "Transfer, alan adının nameserver ve DNS ayarlarını değiştirmez. Mevcut ayarlarınız geçerli kaldığı sürece web siteniz ve e-postanız çalışmaya devam eder.",
  },
  {
    question: "Hangi alan adları transfer edilemez?",
    answer:
      "Son 60 gün içinde kaydedilmiş veya transfer edilmiş, süresi dolmuş ya da transfer kilidi açık olmayan alan adları transfer edilemez. Böyle bir durumda önce mevcut firmanızla iletişime geçin.",
  },
  {
    question: "Fiyatlara KDV dahil mi?",
    answer: "Hayır. Gösterilen fiyatlara KDV dahil değildir; %20 KDV ödeme adımında eklenir.",
  },
];

export function Content({
  isLoggedIn,
  isAutomatedTransferAvailable,
  tlds,
}: {
  isLoggedIn: boolean;
  isAutomatedTransferAvailable: boolean;
  tlds: TldPriceRow[];
}) {
  return (
    <div className="flex min-h-screen flex-col">
      <Topbar />
      <Header />
      <main id="main" className="flex-1">
        <PageHeader
          eyebrow="Alan adı"
          title="Domain transferi"
          description="Alan adınızı EPP/Auth koduyla KLEACORE'a taşıyın; DNS ve nameserver yönetimini tek panelde toplayın."
          breadcrumbs={[{ label: "Domain", href: "/domain/kayit" }, { label: "Domain transferi" }]}
        >
          <div className="mx-auto max-w-2xl">
            <DomainTransferForm
              isLoggedIn={isLoggedIn}
              isAutomatedTransferAvailable={isAutomatedTransferAvailable}
            />
          </div>
        </PageHeader>

        <TrustBar items={trustItems} bordered={false} />

        <Section tone="muted" divider>
          <SectionHeading
            eyebrow="Süreç"
            title="Transfer nasıl işler?"
            description="Dört adımda alan adınızı taşıyın. Süre, uzantıya ve onayın ne kadar hızlı verildiğine bağlıdır."
            className="mb-10"
          />
          <StepList steps={steps} />
        </Section>

        <Section id="fiyatlar" divider>
          <SectionHeading
            eyebrow="Fiyat listesi"
            title="Transfer ücretleri"
            description="Transfer ücretini, sonraki yılların yenileme ücretiyle birlikte görün."
            className="mb-10"
          />
          <TldPriceTable tlds={tlds} />
        </Section>

        <FaqSection
          items={faqs}
          title="Domain transferi hakkında sorular"
          description="Transfer süreci, EPP kodu ve ücretler hakkında merak edilenler."
          tone="muted"
          divider
        />

        <CtaBand
          eyebrow="Yeni alan adı"
          title="Yeni bir alan adı mı arıyorsunuz?"
          description="Alan adı sorgulayın; kayıt, yenileme ve transfer ücretlerini uzantı bazında karşılaştırın."
          primary={{ label: "Alan adı sorgula", href: "/domain/kayit" }}
          secondary={{ label: "WHOIS sorgula", href: "/domain/whois" }}
        />
      </main>
      <Footer />
    </div>
  );
}
