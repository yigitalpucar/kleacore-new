import type { Metadata } from "next";
import {
  LegalContactCard,
  LegalLayout,
  LegalSection,
} from "@/components/site/kurumsal/legal-layout";
import { LEGAL_LAST_UPDATED } from "../last-updated";

export const metadata: Metadata = {
  title: "KVKK Aydınlatma Metni",
  description:
    "6698 sayılı KVKK kapsamında veri sorumlusu, işlenen kişisel veriler, hukuki dayanaklar, saklama süreleri ve haklarınız.",
  alternates: { canonical: "/yasal/kvkk" },
  openGraph: {
    title: "KVKK Aydınlatma Metni | KLEACORE",
    description:
      "6698 Sayılı Kişisel Verilerin Korunması Kanunu kapsamında haklarınız ve verilerinizin işlenme koşulları.",
    url: "/yasal/kvkk",
  },
};

const sections = [
  { id: "veri-sorumlusu", title: "Veri Sorumlusu" },
  { id: "toplanan-veriler", title: "Toplanan Veriler" },
  { id: "hukuki-dayanak", title: "Hukuki Dayanak" },
  { id: "haklariniz", title: "Haklarınız" },
  { id: "veri-saklama", title: "Veri Saklama" },
  { id: "guvenlik", title: "Veri Güvenliği" },
  { id: "uluslararasi", title: "Uluslararası Transferler" },
  { id: "iletisim", title: "İletişim" },
];

const controller = [
  { label: "Şirket", value: "KLEAWORK DIGITAL LLC" },
  { label: "Marka", value: "KLEACORE" },
  { label: "Adres", value: "30 N Gould St Ste R, Sheridan, WY 82801, USA" },
  { label: "EIN", value: "36-5157418" },
];

const dataCategories = [
  {
    title: "Kimlik Bilgileri",
    items: ["Ad, soyad", "Kullanıcı adı", "Hesap bilgileri (şifrelenmiş)"],
  },
  {
    title: "İletişim Bilgileri",
    items: ["E-posta adresi", "Telefon numarası (opsiyonel)", "Fatura adresi"],
  },
  {
    title: "Finansal Bilgiler",
    items: ["Ödeme kartı bilgileri (güvenli işlemci)", "Fatura geçmişi", "İşlem kayıtları"],
  },
  {
    title: "Teknik Bilgiler",
    items: ["IP adresi", "Tarayıcı türü ve sürümü", "Erişim logları", "Çerez verileri"],
  },
];

const rights = [
  { title: "Bilgi Edinme", description: "Kişisel verilerinizin işlenip işlenmediğini öğrenme" },
  { title: "Erişim", description: "İşlenen verilere erişim ve kopya talep etme" },
  { title: "Düzeltme", description: "Eksik veya yanlış verilerin düzeltilmesini isteme" },
  { title: "Silme", description: "Verilerin silinmesini veya yok edilmesini talep etme" },
  { title: "Aktarım", description: "Verilerinizi taşınabilir formatta alma" },
  { title: "İtiraz", description: "Aleyhinize sonuçlanan işlemlere itiraz etme" },
];

export default function KVKKPage() {
  return (
    <LegalLayout
      title="KVKK Aydınlatma Metni"
      description="6698 Sayılı Kişisel Verilerin Korunması Kanunu kapsamında haklarınız ve verilerinizin işlenme koşulları."
      path="/yasal/kvkk"
      updated={LEGAL_LAST_UPDATED}
      sections={sections}
    >
      <LegalSection id="veri-sorumlusu" title="1. Veri Sorumlusu">
        <p>
          KLEAWORK DIGITAL LLC, KLEACORE markası altında faaliyet gösteren ve kişisel verilerinizin
          işlenmesinden sorumlu veri sorumlusudur.
        </p>
        <dl className="not-prose my-6 grid gap-px overflow-hidden rounded-lg border bg-border text-sm sm:grid-cols-2">
          {controller.map((row) => (
            <div key={row.label} className="bg-background p-4">
              <dt className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                {row.label}
              </dt>
              <dd className="mt-1 font-medium text-foreground">{row.value}</dd>
            </div>
          ))}
        </dl>
      </LegalSection>

      <LegalSection id="toplanan-veriler" title="2. Toplanan Kişisel Veriler">
        <p>Aşağıdaki kategorilerde kişisel veriler toplanmakta ve işlenmektedir:</p>
        <div className="not-prose my-6 grid gap-px overflow-hidden rounded-lg border bg-border sm:grid-cols-2">
          {dataCategories.map((category) => (
            <div key={category.title} className="bg-background p-4">
              <p className="text-sm font-medium text-foreground">{category.title}</p>
              <ul className="mt-2 space-y-1">
                {category.items.map((item) => (
                  <li key={item} className="text-sm text-muted-foreground">
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </LegalSection>

      <LegalSection id="hukuki-dayanak" title="3. İşlemenin Hukuki Dayanağı">
        <p>Kişisel verileriniz aşağıdaki hukuki dayanaklara göre işlenmektedir:</p>
        <ul>
          <li>
            <strong>Sözleşmenin ifası:</strong> Hizmet sunumu için gerekli işlemler
          </li>
          <li>
            <strong>Yasal yükümlülük:</strong> Vergi, muhasebe ve düzenleyici uyum
          </li>
          <li>
            <strong>Meşru menfaat:</strong> Güvenlik ve dolandırıcılık önleme
          </li>
          <li>
            <strong>Açık rıza:</strong> Pazarlama iletişimleri
          </li>
        </ul>
      </LegalSection>

      <LegalSection id="haklariniz" title="4. Haklarınız">
        <p>KVKK ve GDPR kapsamında aşağıdaki haklara sahipsiniz:</p>
        <ul className="not-prose my-6 grid gap-px overflow-hidden rounded-lg border bg-border sm:grid-cols-2">
          {rights.map((right, index) => (
            <li key={right.title} className="flex items-start gap-3 bg-background p-4">
              <span
                aria-hidden
                className="mt-0.5 font-mono text-[11px] tracking-[0.1em] text-muted-foreground"
              >
                {String(index + 1).padStart(2, "0")}
              </span>
              <div>
                <p className="text-sm font-medium text-foreground">{right.title}</p>
                <p className="mt-0.5 text-sm text-muted-foreground">{right.description}</p>
              </div>
            </li>
          ))}
        </ul>
      </LegalSection>

      <LegalSection id="veri-saklama" title="5. Veri Saklama Süreleri">
        <p>
          Kişisel verileriniz, hizmet sunumu için gerekli olan süre boyunca ve yasal
          yükümlülüklerimize uygun olarak saklanır. Hesap verileri, hizmet ilişkisi süresince ve
          yasal saklama süresi boyunca muhafaza edilir.
        </p>
      </LegalSection>

      <LegalSection id="guvenlik" title="6. Veri Güvenliği">
        <p>
          Kişisel verilerinizi korumak için uygun teknik ve organizasyonel önlemler
          uygulamaktayız:
        </p>
        <ul>
          <li>Aktarım sırasında SSL/TLS şifreleme</li>
          <li>Hassas veriler için depolama şifrelemesi</li>
          <li>Erişim kontrolleri ve kimlik doğrulama</li>
          <li>Düzenli güvenlik denetimleri</li>
          <li>Veri koruma eğitimleri</li>
        </ul>
      </LegalSection>

      <LegalSection id="uluslararasi" title="7. Uluslararası Veri Transferleri">
        <p>
          Verileriniz Amerika Birleşik Devletleri&apos;ne aktarılabilir ve burada işlenebilir.
          Uluslararası veri aktarımları için yürürlükteki mevzuata uygun güvenceler
          sağlanmaktadır.
        </p>
      </LegalSection>

      <LegalSection id="iletisim" title="8. İletişim">
        <p>Bu aydınlatma metni hakkında sorularınız veya haklarınızı kullanmak için:</p>
        <LegalContactCard
          heading="Veri Koruma İletişim"
          emails={["privacy@kleacore.com"]}
          showEin={false}
        />
      </LegalSection>
    </LegalLayout>
  );
}
