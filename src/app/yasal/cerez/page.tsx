import type { Metadata } from "next";
import {
  LegalCallout,
  LegalContactCard,
  LegalLayout,
  LegalRows,
  LegalSection,
} from "@/components/site/kurumsal/legal-layout";
import { LEGAL_LAST_UPDATED } from "../last-updated";

export const metadata: Metadata = {
  title: "Çerez Politikası",
  description:
    "KLEACORE web sitesinde kullanılan zorunlu, performans, işlevsel ve hedefleme çerezleri ile çerez tercihlerinizi nasıl yöneteceğiniz.",
  alternates: { canonical: "/yasal/cerez" },
  openGraph: {
    title: "Çerez Politikası | KLEACORE",
    description: "Web sitemizde çerezleri nasıl kullandığımız hakkında bilgi edinin.",
    url: "/yasal/cerez",
  },
};

const sections = [
  { id: "genel", title: "Çerez Nedir?" },
  { id: "kullanim", title: "Çerez Kullanımımız" },
  { id: "zorunlu", title: "Zorunlu Çerezler" },
  { id: "performans", title: "Performans Çerezleri" },
  { id: "islevsel", title: "İşlevsel Çerezler" },
  { id: "hedefleme", title: "Hedefleme Çerezleri" },
  { id: "ucuncu", title: "Üçüncü Taraf Çerezleri" },
  { id: "yonetim", title: "Çerez Yönetimi" },
  { id: "iletisim", title: "İletişim" },
];

const thirdPartyCookies = [
  { name: "Google Analytics", purpose: "Site trafiği analizi", website: "analytics.google.com" },
  { name: "Google Tag Manager", purpose: "Etiket yönetimi", website: "tagmanager.google.com" },
  { name: "Cloudflare", purpose: "Güvenlik ve performans", website: "cloudflare.com" },
  { name: "Crisp", purpose: "Canlı destek", website: "crisp.chat" },
];

const essentialExamples = ["Oturum yönetimi", "CSRF koruması", "Yük dengeleme", "Sepet bilgileri"];

export default function CerezPolitikasiPage() {
  return (
    <LegalLayout
      title="Çerez Politikası"
      description="Web sitemizde çerezleri nasıl kullandığımız hakkında bilgi edinin."
      path="/yasal/cerez"
      updated={LEGAL_LAST_UPDATED}
      sections={sections}
    >
      <LegalSection id="genel" title="1. Çerez Nedir?">
        <p>
          Çerezler, web sitelerinin tarayıcınıza yerleştirdiği küçük metin dosyalarıdır. Bu
          dosyalar, sizi tanımak, tercihlerinizi hatırlamak ve size daha iyi bir deneyim sunmak
          için kullanılır.
        </p>
        <p>Çerezler genellikle şu bilgileri içerir:</p>
        <ul>
          <li>Çerezi oluşturan web sitesinin adı</li>
          <li>Çerezin ömrü (ne kadar süre saklanacağı)</li>
          <li>Rastgele oluşturulmuş benzersiz bir numara</li>
        </ul>
      </LegalSection>

      <LegalSection id="kullanim" title="2. Çerez Kullanımımız">
        <p>KLEACORE olarak çerezleri aşağıdaki amaçlarla kullanmaktayız:</p>
        <ul>
          <li>Web sitemizin düzgün çalışmasını sağlamak</li>
          <li>Oturum bilgilerinizi güvenli şekilde saklamak</li>
          <li>Tercihlerinizi hatırlamak (dil, tema vb.)</li>
          <li>Site performansını analiz etmek ve iyileştirmek</li>
          <li>Size kişiselleştirilmiş içerik sunmak</li>
        </ul>
      </LegalSection>

      <LegalSection id="zorunlu" title="3. Zorunlu Çerezler">
        <p>
          Bu çerezler web sitemizin temel işlevlerini yerine getirmesi için gereklidir. Bu çerezler
          olmadan site düzgün çalışmaz.
        </p>
        <div className="not-prose my-6 rounded-lg border p-4 sm:p-5">
          <p className="text-sm font-medium text-foreground">Zorunlu Çerezler</p>
          <p className="mt-1 text-sm text-muted-foreground">Bu çerezler devre dışı bırakılamaz.</p>
          <ul className="mt-3 flex flex-wrap gap-2">
            {essentialExamples.map((example) => (
              <li
                key={example}
                className="rounded-md border bg-muted/40 px-2.5 py-1 font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground"
              >
                {example}
              </li>
            ))}
          </ul>
        </div>
      </LegalSection>

      <LegalSection id="performans" title="4. Performans Çerezleri">
        <p>
          Bu çerezler, ziyaretçilerin sitemizi nasıl kullandığını anlamamıza yardımcı olur.
          Toplanan veriler anonim olarak işlenir.
        </p>
        <ul>
          <li>Hangi sayfaların en çok ziyaret edildiği</li>
          <li>Kullanıcıların sitede geçirdiği süre</li>
          <li>Hata mesajları ve teknik sorunlar</li>
          <li>Sayfa yükleme süreleri</li>
        </ul>
      </LegalSection>

      <LegalSection id="islevsel" title="5. İşlevsel Çerezler">
        <p>Bu çerezler, size daha kişiselleştirilmiş bir deneyim sunmamızı sağlar:</p>
        <ul>
          <li>Dil ve bölge tercihleriniz</li>
          <li>Tema ayarlarınız (açık/koyu mod)</li>
          <li>Daha önce görüntülediğiniz ürünler</li>
          <li>Form bilgilerinin hatırlanması</li>
        </ul>
      </LegalSection>

      <LegalSection id="hedefleme" title="6. Hedefleme ve Reklam Çerezleri">
        <p>
          Bu çerezler, ilgi alanlarınıza uygun içerik ve reklamlar göstermek için kullanılır:
        </p>
        <ul>
          <li>İlgi alanlarınıza göre reklam gösterimi</li>
          <li>Reklam performansının ölçülmesi</li>
          <li>Sosyal medya entegrasyonu</li>
          <li>Yeniden pazarlama kampanyaları</li>
        </ul>
        <p>
          Bu çerezleri tarayıcı ayarlarınızdan veya çerez tercih merkezimizden devre dışı
          bırakabilirsiniz.
        </p>
      </LegalSection>

      <LegalSection id="ucuncu" title="7. Üçüncü Taraf Çerezleri">
        <p>Web sitemizde aşağıdaki üçüncü taraf hizmetlerinin çerezleri bulunabilir:</p>
        <LegalRows
          rows={thirdPartyCookies.map((cookie) => ({
            title: cookie.name,
            description: cookie.purpose,
            value: cookie.website,
          }))}
        />
        <p>Bu hizmetlerin gizlilik politikaları için ilgili web sitelerini ziyaret edebilirsiniz.</p>
      </LegalSection>

      <LegalSection id="yonetim" title="8. Çerez Yönetimi">
        <p>Çerezleri aşağıdaki yöntemlerle yönetebilirsiniz:</p>

        <h3>Tarayıcı Ayarları</h3>
        <p>Tarayıcınızın ayarlarından çerezleri engelleyebilir veya silebilirsiniz:</p>
        <ul>
          <li>
            <strong>Chrome:</strong> Ayarlar → Gizlilik ve güvenlik → Çerezler
          </li>
          <li>
            <strong>Firefox:</strong> Ayarlar → Gizlilik ve Güvenlik → Çerezler
          </li>
          <li>
            <strong>Safari:</strong> Tercihler → Gizlilik → Çerezler
          </li>
          <li>
            <strong>Edge:</strong> Ayarlar → Gizlilik → Çerezler
          </li>
        </ul>

        <h3>Çerez Tercih Merkezi</h3>
        <p>
          Web sitemizin alt kısmındaki &quot;Çerez Ayarları&quot; bağlantısına tıklayarak
          tercihlerinizi istediğiniz zaman değiştirebilirsiniz.
        </p>

        <LegalCallout title="Önemli Uyarı" tone="warning">
          Zorunlu çerezleri devre dışı bırakmanız durumunda web sitemizin bazı özellikleri düzgün
          çalışmayabilir. Örneğin, oturum açık kalmayabilir veya sepetinizdeki ürünler
          kaybolabilir.
        </LegalCallout>
      </LegalSection>

      <LegalSection id="iletisim" title="9. İletişim">
        <p>Çerez politikamız hakkında sorularınız için:</p>
        <LegalContactCard emails={["privacy@kleacore.com"]} />
        <p className="text-sm text-muted-foreground">
          Bu politika, yasal gereklilikler veya hizmetlerimizdeki değişiklikler nedeniyle
          güncellenebilir. Önemli değişikliklerde sizi bilgilendireceğiz.
        </p>
      </LegalSection>
    </LegalLayout>
  );
}
