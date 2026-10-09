import type { LegalDocumentType } from "@prisma/client";

/**
 * Version 1 of each legal document, created on first use (see
 * ensureLegalDocuments). The distance-sales contract and the preliminary
 * information form are PLACEHOLDERS written by the developer — they must be
 * reviewed by a lawyer and republished as version 2 before relying on them.
 * The KVKK notice mirrors the published /yasal/kvkk page.
 *
 * Variables: see src/lib/legal/render.ts.
 */

export interface DefaultLegalDocument {
  type: LegalDocumentType;
  version: number;
  title: string;
  isPlaceholder: boolean;
  content: string;
}

const PLACEHOLDER_NOTICE =
  '<p class="legal-placeholder"><strong>TASLAK METİN:</strong> Bu belge hukuki inceleme ' +
  "bekleyen bir taslaktır; avukat onayından sonra yeni sürüm olarak yayımlanacaktır.</p>";

const DISTANCE_SALES_CONTRACT = `${PLACEHOLDER_NOTICE}
<h2>1. Taraflar</h2>
<p><strong>Satıcı / Hizmet Sağlayıcı:</strong> {{seller.name}}<br>
Adres: {{seller.address}}<br>
Vergi / şirket kimlik no: {{seller.tax_id}}<br>
E-posta: {{seller.email}} · Telefon: {{seller.phone}}<br>
İnternet sitesi: {{seller.website}}</p>
<p><strong>Alıcı:</strong> {{buyer.name}}<br>
E-posta: {{buyer.email}} · Telefon: {{buyer.phone}}<br>
Adres: {{buyer.address}}</p>

<h2>2. Konu</h2>
<p>Bu sözleşme, Alıcı'nın Satıcı'ya ait internet sitesi üzerinden elektronik ortamda sipariş
verdiği aşağıda nitelikleri ve satış fiyatı belirtilen hizmetlerin sunulmasına ilişkin olarak
6502 sayılı Tüketicinin Korunması Hakkında Kanun ve Mesafeli Sözleşmeler Yönetmeliği
hükümleri uyarınca tarafların hak ve yükümlülüklerini düzenler.</p>

<h2>3. Sözleşme konusu hizmetler</h2>
<p>Sipariş tarihi: {{order.date}} · Sipariş no: {{order.numbers}}</p>
{{order.items_table}}
<p>Tüm fiyatlara KDV dahildir. Ödenecek toplam tutar: <strong>{{order.total}}</strong>.</p>

<h2>4. Ödeme</h2>
<p>Ödeme yöntemi: {{order.payment_method}}. Hizmet bedeli, sipariş onayında seçilen yöntemle
peşin olarak tahsil edilir. Banka havalesi ile ödemelerde hizmet, ödemenin Satıcı hesabına
geçmesiyle başlatılır.</p>

<h2>5. Hizmetin ifası</h2>
<p>Sözleşme konusu hizmetler elektronik ortamda sunulan dijital hizmetlerdir (barındırma,
sunucu, alan adı tescili, SSL sertifikası vb.). Hizmet, ödemenin onaylanmasının ardından
elektronik ortamda derhal veya hizmetin niteliğine göre belirtilen kurulum süresi içinde
ifa edilir; erişim bilgileri Alıcı'nın müşteri paneline ve e-posta adresine iletilir.</p>

<h2>6. Cayma hakkı</h2>
<p>Mesafeli Sözleşmeler Yönetmeliği'nin 15. maddesinin (ğ) bendi uyarınca elektronik ortamda
anında ifa edilen hizmetlere ve tüketiciye anında teslim edilen gayrimaddi mallara ilişkin
sözleşmelerde cayma hakkı kullanılamaz. Alıcı, siparişi onaylayarak hizmetin ifasına cayma
süresi dolmadan başlanmasını kabul ettiğini ve bu nedenle cayma hakkını kaybedeceğini
bildiğini beyan eder. Alan adı tescil ve yenilemeleri ile SSL sertifikaları, üçüncü taraf
kayıt kuruluşlarına anında iletildiğinden iade edilemez. Satıcı'nın gönüllü iade
politikası <a href="/yasal/iade-kosullari">İade Koşulları</a> sayfasında yer alır.</p>

<h2>7. Genel hükümler</h2>
<p>Hizmetlerin kullanımı <a href="/yasal/kullanim-kosullari">Kullanım Koşulları</a>'na
tabidir. Kişisel veriler <a href="/yasal/kvkk">KVKK Aydınlatma Metni</a> kapsamında
işlenir. Alıcı, ön bilgilendirme formunu okuyup bilgi sahibi olduğunu ve bu sözleşmeyi
elektronik ortamda onayladığını kabul eder.</p>

<h2>8. Uyuşmazlıkların çözümü</h2>
<p>Bu sözleşmeden doğan uyuşmazlıklarda, Ticaret Bakanlığı'nca ilan edilen parasal sınırlar
dahilinde Alıcı'nın yerleşim yerindeki veya işlemin yapıldığı yerdeki Tüketici Hakem
Heyetleri ile Tüketici Mahkemeleri yetkilidir.</p>
`;

const PRELIMINARY_INFORMATION = `${PLACEHOLDER_NOTICE}
<p>Bu form, 6502 sayılı Tüketicinin Korunması Hakkında Kanun ve Mesafeli Sözleşmeler
Yönetmeliği uyarınca, mesafeli sözleşme kurulmadan önce Alıcı'yı bilgilendirmek amacıyla
düzenlenmiştir.</p>

<h2>1. Satıcı bilgileri</h2>
<p>Unvan: {{seller.name}}<br>
Adres: {{seller.address}}<br>
Vergi / şirket kimlik no: {{seller.tax_id}}<br>
E-posta: {{seller.email}} · Telefon: {{seller.phone}}</p>

<h2>2. Alıcı bilgileri</h2>
<p>Ad soyad / unvan: {{buyer.name}}<br>
E-posta: {{buyer.email}} · Telefon: {{buyer.phone}}<br>
Adres: {{buyer.address}}</p>

<h2>3. Hizmetlerin temel nitelikleri ve fiyatı</h2>
<p>Sipariş tarihi: {{order.date}}</p>
{{order.items_table}}
<p>Fiyatlara KDV (%{{order.tax_rate}}) dahildir. Toplam ödenecek tutar:
<strong>{{order.total}}</strong>. Yenileme dönemlerinde o tarihte geçerli liste fiyatı
uygulanır; yenileme faturaları vade tarihinden önce müşteri paneline ve e-posta adresine
gönderilir.</p>

<h2>4. Ödeme ve ifa</h2>
<p>Ödeme yöntemi: {{order.payment_method}}. Hizmetler dijital olarak, ödeme onayının
ardından elektronik ortamda sunulur; ayrıca bir teslimat veya kargo masrafı yoktur.</p>

<h2>5. Cayma hakkı</h2>
<p>Elektronik ortamda anında ifa edilen hizmetler ile anında teslim edilen gayrimaddi
mallarda Mesafeli Sözleşmeler Yönetmeliği md. 15/1-(ğ) uyarınca cayma hakkı bulunmamaktadır.
Siparişinizi onayladığınızda hizmetin ifasına derhal başlanır ve cayma hakkınızı
kaybedersiniz. Gönüllü iade koşulları için <a href="/yasal/iade-kosullari">İade Koşulları</a>
sayfasına bakınız.</p>

<h2>6. Şikâyet ve itirazlar</h2>
<p>Şikâyetlerinizi {{seller.email}} adresine veya müşteri panelindeki destek sistemine
iletebilirsiniz. Uyuşmazlıklarda Tüketici Hakem Heyetleri ve Tüketici Mahkemeleri'ne
başvurabilirsiniz.</p>
`;

const KVKK_NOTICE = `<p>6698 Sayılı Kişisel Verilerin Korunması Kanunu kapsamında haklarınız ve verilerinizin
işlenme koşulları. Güncel metin: <a href="/yasal/kvkk">kleacore.com/yasal/kvkk</a>.</p>

<h2>1. Veri Sorumlusu</h2>
<p>KLEAWORK DIGITAL LLC, KLEACORE markası altında faaliyet gösteren ve kişisel verilerinizin
işlenmesinden sorumlu veri sorumlusudur. Adres: 30 N Gould St Ste R, Sheridan, WY 82801, USA.
EIN: 36-5157418.</p>

<h2>2. Toplanan Kişisel Veriler</h2>
<ul>
<li><strong>Kimlik bilgileri:</strong> ad, soyad, kullanıcı adı, hesap bilgileri (şifrelenmiş)</li>
<li><strong>İletişim bilgileri:</strong> e-posta adresi, telefon numarası (opsiyonel), fatura adresi</li>
<li><strong>Finansal bilgiler:</strong> ödeme kartı bilgileri (güvenli işlemci), fatura geçmişi, işlem kayıtları</li>
<li><strong>Teknik bilgiler:</strong> IP adresi, tarayıcı türü ve sürümü, erişim logları, çerez verileri</li>
</ul>

<h2>3. İşlemenin Hukuki Dayanağı</h2>
<ul>
<li><strong>Sözleşmenin ifası:</strong> hizmet sunumu için gerekli işlemler</li>
<li><strong>Yasal yükümlülük:</strong> vergi, muhasebe ve düzenleyici uyum</li>
<li><strong>Meşru menfaat:</strong> güvenlik ve dolandırıcılık önleme</li>
<li><strong>Açık rıza:</strong> pazarlama iletişimleri</li>
</ul>

<h2>4. Haklarınız</h2>
<p>KVKK ve GDPR kapsamında kişisel verilerinizin işlenip işlenmediğini öğrenme, işlenen
verilere erişim ve kopya talep etme, eksik veya yanlış verilerin düzeltilmesini isteme,
verilerin silinmesini veya yok edilmesini talep etme, verilerinizi taşınabilir formatta alma
ve aleyhinize sonuçlanan işlemlere itiraz etme haklarına sahipsiniz.</p>

<h2>5. Veri Saklama Süreleri</h2>
<p>Kişisel verileriniz, hizmet sunumu için gerekli olan süre boyunca ve yasal
yükümlülüklerimize uygun olarak saklanır. Hesap verileri, hizmet ilişkisi süresince ve yasal
saklama süresi boyunca muhafaza edilir.</p>

<h2>6. Veri Güvenliği</h2>
<p>Aktarım sırasında SSL/TLS şifreleme, hassas veriler için depolama şifrelemesi, erişim
kontrolleri ve kimlik doğrulama, düzenli güvenlik denetimleri ve veri koruma eğitimleri
uygulanır.</p>

<h2>7. Uluslararası Veri Transferleri</h2>
<p>Verileriniz Amerika Birleşik Devletleri'ne aktarılabilir ve burada işlenebilir.
Uluslararası veri aktarımları için yürürlükteki mevzuata uygun güvenceler sağlanmaktadır.</p>

<h2>8. İletişim</h2>
<p>Bu aydınlatma metni hakkında sorularınız veya haklarınızı kullanmak için:
privacy@kleacore.com</p>
`;

const MARKETING_CONSENT = `${PLACEHOLDER_NOTICE}
<p>6563 sayılı Elektronik Ticaretin Düzenlenmesi Hakkında Kanun ve Ticari İletişim ve Ticari
Elektronik İletiler Hakkında Yönetmelik kapsamında; kampanya, indirim, yeni ürün ve benzeri
tanıtım amaçlı ticari elektronik iletilerin tarafıma e-posta ve SMS yoluyla gönderilmesine
onay veriyorum.</p>
<p>Bu onayı dilediğim zaman müşteri panelindeki <strong>Hesap ayarları → Bildirimler</strong>
bölümünden veya iletilerdeki <strong>abonelikten çık</strong> bağlantısıyla ücretsiz olarak geri
alabilirim. Onayı geri almam; hizmetlerim, faturalarım ve planlı bakım / kesinti duyuruları gibi
hesabımla ilgili bilgilendirmeleri almama engel değildir.</p>
`;

export const DEFAULT_LEGAL_DOCUMENTS: Record<LegalDocumentType, DefaultLegalDocument> = {
  DISTANCE_SALES_CONTRACT: {
    type: "DISTANCE_SALES_CONTRACT",
    version: 1,
    title: "Mesafeli Satış Sözleşmesi",
    isPlaceholder: true,
    content: DISTANCE_SALES_CONTRACT,
  },
  PRELIMINARY_INFORMATION: {
    type: "PRELIMINARY_INFORMATION",
    version: 1,
    title: "Ön Bilgilendirme Formu",
    isPlaceholder: true,
    content: PRELIMINARY_INFORMATION,
  },
  KVKK_NOTICE: {
    type: "KVKK_NOTICE",
    version: 1,
    title: "KVKK Aydınlatma Metni",
    isPlaceholder: false,
    content: KVKK_NOTICE,
  },
  MARKETING_CONSENT: {
    type: "MARKETING_CONSENT",
    version: 1,
    title: "Ticari Elektronik İleti Onayı",
    isPlaceholder: true,
    content: MARKETING_CONSENT,
  },
};
