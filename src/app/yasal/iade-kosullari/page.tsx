import type { Metadata } from "next";
import {
  LegalBoxList,
  LegalCallout,
  LegalContactCard,
  LegalLayout,
  LegalRows,
  LegalSection,
} from "@/components/site/kurumsal/legal-layout";
import { LEGAL_LAST_UPDATED } from "../last-updated";

export const metadata: Metadata = {
  title: "İade Koşulları",
  description:
    "KLEACORE iade politikası: iade kapsamındaki hizmetler, süreler, koşullar, iade dışı hizmetler ve iade talebi adımları.",
  alternates: { canonical: "/yasal/iade-kosullari" },
  openGraph: {
    title: "İade Koşulları | KLEACORE",
    description: "Hizmetlerimiz için geçerli iade süreleri, koşullar ve iade talebi adımları.",
    url: "/yasal/iade-kosullari",
  },
};

const sections = [
  { id: "genel", title: "Genel Bilgiler" },
  { id: "kapsam", title: "İade Kapsamı" },
  { id: "sureler", title: "İade Süreleri" },
  { id: "kosullar", title: "İade Koşulları" },
  { id: "istisna", title: "İade Dışı Hizmetler" },
  { id: "talep", title: "İade Talebi Nasıl Yapılır" },
  { id: "odeme", title: "Ödeme İadesi" },
  { id: "iptal", title: "Hizmet İptali" },
  { id: "iletisim", title: "İletişim" },
];

const refundableServices = [
  { name: "Linux Hosting", period: "30 gün" },
  { name: "WordPress Hosting", period: "30 gün" },
  { name: "Kurumsal Hosting", period: "30 gün" },
  { name: "Reseller Hosting", period: "30 gün" },
  { name: "VDS Sunucu", period: "14 gün" },
  { name: "VPS Sunucu", period: "14 gün" },
  { name: "Bulut Sunucu", period: "7 gün" },
];

const nonRefundableServices = [
  "Alan adı kayıt ve transfer ücretleri",
  "SSL sertifikaları",
  "Lisans ücretleri (cPanel, Plesk, vb.)",
  "Kurulum ve yapılandırma hizmetleri",
  "Özel geliştirme hizmetleri",
  "Fiziksel sunucu ve colocation",
  "IP adresi ve ASN tahsisleri",
  "CDN hizmetleri",
];

const steps = [
  {
    title: "Müşteri Paneline Giriş",
    description: "panel.kleacore.com adresinden hesabınıza giriş yapın",
  },
  {
    title: "Destek Talebi Açın",
    description: "Destek bölümünden \"İade Talebi\" konulu yeni bir ticket oluşturun",
  },
  {
    title: "Bilgileri Sağlayın",
    description: "Hizmet adı, sipariş numarası ve iade nedeninizi belirtin",
  },
  {
    title: "Onay Bekleyin",
    description: "Talebiniz 24-48 saat içinde değerlendirilecektir",
  },
];

export default function IadeKosullariPage() {
  return (
    <LegalLayout
      title="İade Koşulları"
      description="Hizmetlerimizden memnun kalmamanız durumunda geçerli olan iade politikamız."
      path="/yasal/iade-kosullari"
      updated={LEGAL_LAST_UPDATED}
      sections={sections}
    >
      <LegalSection id="genel" title="1. Genel Bilgiler">
        <p>
          KLEACORE (KLEAWORK DIGITAL LLC) olarak müşteri memnuniyetini ön planda tutuyoruz.
          Hizmetlerimizden herhangi bir nedenle memnun kalmamanız durumunda, belirli koşullar
          dahilinde ödemenizin iadesini talep edebilirsiniz.
        </p>
        <p>
          Bu politika, tüm hosting, sunucu ve ilgili hizmetlerimiz için geçerlidir. İade talebinde
          bulunmadan önce lütfen aşağıdaki koşulları dikkatlice okuyunuz.
        </p>
      </LegalSection>

      <LegalSection id="kapsam" title="2. İade Kapsamındaki Hizmetler">
        <p>Aşağıdaki hizmetler para iade garantisi kapsamındadır:</p>
        <LegalRows
          rows={refundableServices.map((service) => ({
            title: service.name,
            value: service.period,
          }))}
        />
      </LegalSection>

      <LegalSection id="sureler" title="3. İade Süreleri">
        <p>İade talepleri, hizmet aktivasyonundan itibaren belirtilen süreler içinde yapılmalıdır:</p>
        <ul>
          <li>
            <strong>Paylaşımlı Hosting:</strong> İlk 30 gün içinde tam iade
          </li>
          <li>
            <strong>VDS/VPS Sunucu:</strong> İlk 14 gün içinde tam iade
          </li>
          <li>
            <strong>Bulut Sunucu:</strong> İlk 7 gün içinde tam iade
          </li>
          <li>
            <strong>Yenileme Ödemeleri:</strong> Yenileme sonrası 48 saat içinde iade
          </li>
        </ul>
        <LegalCallout title="Önemli Uyarı" tone="warning">
          İade süreleri hizmet aktivasyonundan itibaren başlar. Sipariş tarihi değil, hizmetin
          aktif edildiği tarih esas alınır.
        </LegalCallout>
      </LegalSection>

      <LegalSection id="kosullar" title="4. İade Koşulları">
        <p>İade talebinin onaylanması için aşağıdaki koşulların sağlanması gerekmektedir:</p>
        <ul>
          <li>Hizmet, ilk kez satın alınmış olmalıdır (yenileme değil)</li>
          <li>Hesap, kullanım koşullarına aykırı kullanılmamış olmalıdır</li>
          <li>Hesap, spam veya kötü amaçlı yazılım nedeniyle askıya alınmamış olmalıdır</li>
          <li>İade talebi, belirtilen süre içinde yapılmış olmalıdır</li>
          <li>Aynı müşteri tarafından daha önce aynı hizmet için iade alınmamış olmalıdır</li>
        </ul>
        <p>
          KLEACORE, şüpheli veya kötüye kullanım amaçlı iade taleplerini reddetme hakkını saklı
          tutar.
        </p>
      </LegalSection>

      <LegalSection id="istisna" title="5. İade Dışı Hizmetler">
        <p>Aşağıdaki hizmetler ve ürünler hiçbir koşulda iade kapsamında değildir:</p>
        <LegalBoxList title="İade Yapılamayan Hizmetler" items={nonRefundableServices} marker="cross" />
        <p>
          Alan adı kayıtları, kayıt kuruluşlarına (registry) yapılan ödemeler nedeniyle iade
          edilemez. SSL sertifikaları, sertifika otoritelerine yapılan ödemeler nedeniyle iade
          kapsamı dışındadır.
        </p>
      </LegalSection>

      <LegalSection id="talep" title="6. İade Talebi Nasıl Yapılır">
        <p>İade talebinde bulunmak için aşağıdaki adımları izleyebilirsiniz:</p>
        <ol className="not-prose my-6 divide-y overflow-hidden rounded-lg border">
          {steps.map((step, index) => (
            <li key={step.title} className="flex items-start gap-4 p-4">
              <span
                aria-hidden
                className="flex size-8 shrink-0 items-center justify-center rounded-md border bg-muted/40 font-mono text-xs font-medium text-foreground"
              >
                {String(index + 1).padStart(2, "0")}
              </span>
              <div>
                <p className="text-sm font-medium text-foreground">{step.title}</p>
                <p className="mt-0.5 text-sm leading-relaxed text-muted-foreground">
                  {step.description}
                </p>
              </div>
            </li>
          ))}
        </ol>
        <p>
          Alternatif olarak <a href="mailto:support@kleacore.com">support@kleacore.com</a> adresine
          e-posta göndererek de iade talebinde bulunabilirsiniz.
        </p>
      </LegalSection>

      <LegalSection id="odeme" title="7. Ödeme İadesi">
        <p>Onaylanan iade talepleri için ödeme iadesi aşağıdaki şekilde yapılır:</p>
        <ul>
          <li>
            <strong>Kredi Kartı:</strong> Ödeme yapılan karta 7-14 iş günü içinde
          </li>
          <li>
            <strong>Banka Havalesi/EFT:</strong> Belirtilen hesaba 3-5 iş günü içinde
          </li>
          <li>
            <strong>Hesap Bakiyesi:</strong> Anında hesap bakiyesine yüklenir
          </li>
        </ul>
        <p>
          İade tutarından, varsa kullanılan kaynak bedeli ve işlem masrafları düşülebilir. Kısmi
          kullanım durumunda orantılı iade yapılabilir.
        </p>
      </LegalSection>

      <LegalSection id="iptal" title="8. Hizmet İptali">
        <p>İade talebiniz onaylandığında ilgili hizmet otomatik olarak iptal edilir:</p>
        <ul>
          <li>Tüm verileriniz 7 gün içinde silinir</li>
          <li>Silinen veriler kurtarılamaz</li>
          <li>Alan adları (varsa) serbest bırakılır veya transfer edilebilir</li>
          <li>E-posta hesapları ve içerikleri silinir</li>
        </ul>
        <LegalCallout title="Veri Yedekleme" tone="warning">
          İade talebi yapmadan önce tüm verilerinizi yedeklemenizi önemle tavsiye ederiz. İptal
          sonrası verilerinize erişim mümkün olmayacaktır.
        </LegalCallout>
      </LegalSection>

      <LegalSection id="iletisim" title="9. İletişim">
        <p>İade politikamız hakkında sorularınız için:</p>
        <LegalContactCard emails={["support@kleacore.com", "billing@kleacore.com"]} />
        <p className="text-sm text-muted-foreground">
          Bu politikadan doğan uyuşmazlıklarda Amerika Birleşik Devletleri Wyoming eyaleti
          kanunları uygulanır.
        </p>
      </LegalSection>
    </LegalLayout>
  );
}
