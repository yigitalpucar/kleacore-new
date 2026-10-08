import type { Metadata } from "next";
import {
  LegalBoxList,
  LegalContactCard,
  LegalLayout,
  LegalRows,
  LegalSection,
} from "@/components/site/kurumsal/legal-layout";
import { LEGAL_LAST_UPDATED } from "../last-updated";

export const metadata: Metadata = {
  title: "Kullanım Koşulları",
  description:
    "KLEACORE hosting, sunucu, alan adı ve SSL hizmetlerinin kullanım koşulları: hesap güvenliği, kabul edilebilir kullanım, ödeme ve sorumluluk.",
  alternates: { canonical: "/yasal/kullanim-kosullari" },
  openGraph: {
    title: "Kullanım Koşulları | KLEACORE",
    description: "Hizmetlerimizi kullanırken geçerli olan kurallar ve koşullar.",
    url: "/yasal/kullanim-kosullari",
  },
};

const sections = [
  { id: "genel", title: "Genel Hükümler" },
  { id: "hizmetler", title: "Hizmet Tanımları" },
  { id: "hesap", title: "Hesap Güvenliği" },
  { id: "aup", title: "Kabul Edilebilir Kullanım" },
  { id: "kaynak", title: "Kaynak Kullanımı" },
  { id: "odeme", title: "Ödeme Koşulları" },
  { id: "iade", title: "İade Politikası" },
  { id: "sla", title: "SLA Taahhüdü" },
  { id: "yedekleme", title: "Yedekleme" },
  { id: "sorumluluk", title: "Sorumluluk Sınırlaması" },
  { id: "iletisim", title: "İletişim" },
];

export default function KullanimKosullariPage() {
  return (
    <LegalLayout
      title="Kullanım Koşulları"
      description="Hizmetlerimizi kullanırken geçerli olan kurallar ve koşullar."
      path="/yasal/kullanim-kosullari"
      updated={LEGAL_LAST_UPDATED}
      sections={sections}
    >
      <LegalSection id="genel" title="1. Genel Hükümler">
        <p>
          Bu Kullanım Koşulları, KLEACORE (KLEAWORK DIGITAL LLC) tarafından sunulan hosting,
          sunucu, alan adı ve ilgili hizmetlerin kullanımını düzenlemektedir. Hizmetlerimizi
          kullanarak bu koşulları kabul etmiş sayılırsınız.
        </p>
      </LegalSection>

      <LegalSection id="hizmetler" title="2. Hizmet Tanımları">
        <p>KLEACORE aşağıdaki hizmetleri sunmaktadır:</p>
        <LegalRows
          rows={[
            { title: "Web Hosting", description: "Paylaşımlı, VPS ve dedicated hosting çözümleri" },
            { title: "Alan Adı", description: "Domain kayıt ve yönetim hizmetleri" },
            { title: "SSL Sertifikaları", description: "DV, OV ve EV SSL sertifikaları" },
            { title: "Sunucu Barındırma", description: "Colocation ve veri merkezi hizmetleri" },
          ]}
        />
      </LegalSection>

      <LegalSection id="hesap" title="3. Hesap Oluşturma ve Güvenlik">
        <p>
          Hizmetlerimizi kullanmak için bir hesap oluşturmanız gerekmektedir. Hesap oluşturma
          sırasında:
        </p>
        <ul>
          <li>Doğru ve güncel bilgiler vermelisiniz</li>
          <li>Hesap güvenliğinizden siz sorumlusunuz</li>
          <li>Şifrenizi gizli tutmalısınız</li>
          <li>Hesabınızdaki tüm aktivitelerden sorumlusunuz</li>
          <li>Yetkisiz erişim durumunda derhal bizi bilgilendirmelisiniz</li>
        </ul>
      </LegalSection>

      <LegalSection id="aup" title="4. Kabul Edilebilir Kullanım Politikası">
        <p>Hizmetlerimizi kullanırken aşağıdaki faaliyetler yasaktır:</p>
        <LegalBoxList
          title="Yasaklanan Faaliyetler"
          marker="cross"
          items={[
            "Yasa dışı içerik barındırma veya dağıtma",
            "Spam e-posta gönderimi",
            "Telif hakkı ihlali",
            "Kötü amaçlı yazılım dağıtımı",
            "DDoS saldırıları veya ağ suistimali",
            "Phishing veya dolandırıcılık faaliyetleri",
          ]}
        />
      </LegalSection>

      <LegalSection id="kaynak" title="5. Kaynak Kullanımı">
        <p>Paylaşımlı hosting hizmetlerinde kaynak kullanımı makul sınırlar içinde olmalıdır:</p>
        <ul>
          <li>CPU kullanımı diğer kullanıcıları etkilememelidir</li>
          <li>Disk alanı ve bant genişliği limitlerine uyulmalıdır</li>
          <li>Aşırı kaynak kullanımı hesap askıya alınmasına neden olabilir</li>
          <li>Yoğun kaynak gerektiren projeler için VPS veya dedicated sunucu önerilir</li>
        </ul>
      </LegalSection>

      <LegalSection id="odeme" title="6. Ödeme Koşulları">
        <ul>
          <li>Hizmet bedelleri peşin olarak tahsil edilir</li>
          <li>Faturalar e-posta ile gönderilir</li>
          <li>Ödemeler kredi kartı, banka havalesi veya EFT ile yapılabilir</li>
          <li>Gecikmeli ödemelerde hizmet askıya alınabilir</li>
          <li>30 günlük ödeme gecikmesinde hesap silinebilir</li>
          <li>Fiyatlar KDV dahil veya hariç olarak belirtilir</li>
        </ul>
      </LegalSection>

      <LegalSection id="iade" title="7. İade Politikası">
        <p>Yeni hosting hizmetlerinde 30 gün para iade garantisi sunulmaktadır:</p>
        <div className="not-prose my-6 grid gap-px overflow-hidden rounded-lg border bg-border sm:grid-cols-2">
          <div className="bg-background p-4">
            <p className="mb-2 text-sm font-medium text-foreground">İade Kapsamında</p>
            <ul className="space-y-1 text-sm text-muted-foreground">
              <li>Hosting paketleri</li>
              <li>VPS sunucular</li>
              <li>İlk 30 gün içinde talep</li>
            </ul>
          </div>
          <div className="bg-background p-4">
            <p className="mb-2 text-sm font-medium text-foreground">İade Dışında</p>
            <ul className="space-y-1 text-sm text-muted-foreground">
              <li>Alan adı ücretleri</li>
              <li>SSL sertifikaları</li>
              <li>Özel yapılandırmalar</li>
            </ul>
          </div>
        </div>
      </LegalSection>

      <LegalSection id="sla" title="8. Hizmet Seviyesi Taahhüdü (SLA)">
        <p>KLEACORE olarak %99.9 uptime garantisi sunmaktayız:</p>
        <ul>
          <li>Planlı bakımlar SLA kapsamı dışındadır</li>
          <li>DDoS saldırıları SLA kapsamı dışındadır</li>
          <li>SLA ihlalinde aylık hizmet bedelinden kredi sağlanır</li>
          <li>Kredi talebi 30 gün içinde yapılmalıdır</li>
        </ul>
      </LegalSection>

      <LegalSection id="yedekleme" title="9. Yedekleme">
        <ul>
          <li>Günlük otomatik yedekleme sağlanır</li>
          <li>Yedekler 7-30 gün saklanır (pakete göre değişir)</li>
          <li>Kullanıcılar kendi yedeklerini de almalıdır</li>
          <li>Yedeklerin bütünlüğü garanti edilmez, sorumluluk kabul edilmez</li>
        </ul>
      </LegalSection>

      <LegalSection id="sorumluluk" title="10. Sorumluluk Sınırlaması">
        <p>KLEACORE aşağıdaki durumlarda sorumluluk kabul etmez:</p>
        <ul>
          <li>Veri kaybı veya hasarı</li>
          <li>İş kaybı veya kar kaybı</li>
          <li>Üçüncü taraf hizmetlerinin kesintisi</li>
          <li>Mücbir sebepler (doğal afet, savaş, vb.)</li>
          <li>Müşteri hatası veya ihmali</li>
        </ul>
        <p>Toplam sorumluluk, son 12 ayda ödenen hizmet bedeli ile sınırlıdır.</p>
      </LegalSection>

      <LegalSection id="iletisim" title="11. İletişim">
        <p>Kullanım Koşulları hakkında sorularınız için:</p>
        <LegalContactCard emails={["legal@kleacore.com"]} />
        <p className="text-sm text-muted-foreground">
          Bu sözleşmeden doğan uyuşmazlıklarda Amerika Birleşik Devletleri Wyoming eyaleti
          kanunları uygulanır.
        </p>
      </LegalSection>
    </LegalLayout>
  );
}
