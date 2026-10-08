import type { Metadata } from "next";
import Link from "next/link";
import {
  LegalContactCard,
  LegalLayout,
  LegalRows,
  LegalSection,
} from "@/components/site/kurumsal/legal-layout";
import { LEGAL_LAST_UPDATED } from "../last-updated";

export const metadata: Metadata = {
  title: "Gizlilik Politikası",
  description:
    "KLEACORE gizlilik politikası: hangi kişisel verileri topladığımız, nasıl kullandığımız, kimlerle paylaştığımız ve haklarınız.",
  alternates: { canonical: "/yasal/gizlilik" },
  openGraph: {
    title: "Gizlilik Politikası | KLEACORE",
    description: "Kişisel verilerinizin nasıl toplandığını, kullanıldığını ve korunduğunu öğrenin.",
    url: "/yasal/gizlilik",
  },
};

const sections = [
  { id: "giris", title: "Giriş" },
  { id: "toplanan-bilgiler", title: "Toplanan Bilgiler" },
  { id: "kullanim-amaclari", title: "Kullanım Amaçları" },
  { id: "bilgi-paylasimi", title: "Bilgi Paylaşımı" },
  { id: "cerezler", title: "Çerezler" },
  { id: "veri-guvenligi", title: "Veri Güvenliği" },
  { id: "saklama-suresi", title: "Saklama Süresi" },
  { id: "haklariniz", title: "Haklarınız" },
  { id: "iletisim", title: "İletişim" },
];

export default function GizlilikPage() {
  return (
    <LegalLayout
      title="Gizlilik Politikası"
      description="Kişisel verilerinizin nasıl toplandığını, kullanıldığını ve korunduğunu öğrenin."
      path="/yasal/gizlilik"
      updated={LEGAL_LAST_UPDATED}
      sections={sections}
    >
      <LegalSection id="giris" title="1. Giriş">
        <p>
          KLEACORE (KLEAWORK DIGITAL LLC) olarak, müşterilerimizin gizliliğine büyük önem
          veriyoruz. Bu Gizlilik Politikası, web sitemizi ziyaret ettiğinizde ve hizmetlerimizi
          kullandığınızda kişisel verilerinizi nasıl topladığımızı, kullandığımızı ve
          koruduğumuzu açıklamaktadır.
        </p>
      </LegalSection>

      <LegalSection id="toplanan-bilgiler" title="2. Toplanan Bilgiler">
        <p>Aşağıdaki türde kişisel veriler toplanabilir:</p>
        <LegalRows
          rows={[
            {
              title: "Kimlik Bilgileri",
              description:
                "Ad, soyad, TC kimlik numarası (kurumsal müşteriler için vergi numarası)",
            },
            {
              title: "İletişim Bilgileri",
              description: "E-posta adresi, telefon numarası, posta adresi",
            },
            { title: "Hesap Bilgileri", description: "Kullanıcı adı, şifre (şifrelenmiş olarak)" },
            {
              title: "Ödeme Bilgileri",
              description: "Kredi kartı bilgileri (PCI-DSS uyumlu şekilde işlenir)",
            },
            {
              title: "Teknik Bilgiler",
              description: "IP adresi, tarayıcı türü, işletim sistemi, erişim zamanları",
            },
          ]}
        />
      </LegalSection>

      <LegalSection id="kullanim-amaclari" title="3. Bilgilerin Kullanım Amaçları">
        <p>Toplanan kişisel veriler aşağıdaki amaçlarla kullanılır:</p>
        <ul>
          <li>Hizmet sağlama ve sipariş işleme</li>
          <li>Müşteri desteği sunma</li>
          <li>Fatura ve ödeme işlemleri</li>
          <li>Hizmet güncellemeleri ve bildirimleri gönderme</li>
          <li>Yasal yükümlülüklerin yerine getirilmesi</li>
          <li>Hizmet kalitesinin iyileştirilmesi</li>
        </ul>
      </LegalSection>

      <LegalSection id="bilgi-paylasimi" title="4. Bilgi Paylaşımı">
        <p>Kişisel verileriniz, aşağıdaki durumlar dışında üçüncü taraflarla paylaşılmaz:</p>
        <ul>
          <li>Yasal zorunluluk halinde yetkili kurumlarla</li>
          <li>Hizmet sağlayıcılarımızla (ödeme işlemcileri, veri merkezi ortakları)</li>
          <li>Açık rızanız ile</li>
        </ul>
      </LegalSection>

      <LegalSection id="cerezler" title="5. Çerezler (Cookies)">
        <p>
          Web sitemiz, kullanıcı deneyimini iyileştirmek için çerezler kullanmaktadır. Çerezler
          hakkında detaylı bilgi için <Link href="/yasal/cerez">Çerez Politikamızı</Link>{" "}
          inceleyebilirsiniz. Tarayıcı ayarlarınızdan çerezleri devre dışı bırakabilirsiniz.
        </p>
      </LegalSection>

      <LegalSection id="veri-guvenligi" title="6. Veri Güvenliği">
        <p>Kişisel verilerinizin güvenliğini sağlamak için aşağıdaki önlemleri alıyoruz:</p>
        <ul>
          <li>SSL/TLS şifreleme</li>
          <li>Güvenlik duvarları ve saldırı tespit sistemleri</li>
          <li>Düzenli güvenlik denetimleri</li>
          <li>Erişim kontrolleri ve yetkilendirme</li>
          <li>Çalışan eğitimleri</li>
        </ul>
      </LegalSection>

      <LegalSection id="saklama-suresi" title="7. Veri Saklama Süresi">
        <p>
          Kişisel verileriniz, hizmet ilişkisi süresince ve yasal saklama süreleri boyunca muhafaza
          edilir. Hesap kapatıldığında, yasal yükümlülükler saklı kalmak kaydıyla verileriniz
          silinir veya anonimleştirilir.
        </p>
      </LegalSection>

      <LegalSection id="haklariniz" title="8. Haklarınız">
        <p>KVKK kapsamında aşağıdaki haklara sahipsiniz:</p>
        <ul>
          <li>Kişisel verilerinizin işlenip işlenmediğini öğrenme</li>
          <li>İşlenmişse buna ilişkin bilgi talep etme</li>
          <li>İşlenme amacını ve amacına uygun kullanılıp kullanılmadığını öğrenme</li>
          <li>Eksik veya yanlış işlenmişse düzeltilmesini isteme</li>
          <li>Silinmesini veya yok edilmesini isteme</li>
          <li>İşlenen verilerin üçüncü kişilere bildirilmesini isteme</li>
          <li>Aleyhine bir sonuç çıkmasına itiraz etme</li>
          <li>Zarara uğramanız halinde tazminat talep etme</li>
        </ul>
      </LegalSection>

      <LegalSection id="iletisim" title="9. İletişim">
        <p>Gizlilik Politikamız hakkında sorularınız için bizimle iletişime geçebilirsiniz:</p>
        <LegalContactCard emails={["privacy@kleacore.com"]} />
      </LegalSection>
    </LegalLayout>
  );
}
