/**
 * Wave 5 SEO content — Turkish blog articles for KLEACORE.
 * Each article: title, slug, excerpt, markdown (500+ words), category, tags, meta.
 */

export const blogCategories = [
  {
    slug: "domain",
    name: "Domain & Alan Adı",
    description: "Alan adı kayıt, transfer ve DNS yönetimi rehberleri",
  },
  {
    slug: "hosting",
    name: "Web Hosting",
    description: "Hosting seçimi, WordPress ve site yönetimi rehberleri",
  },
  {
    slug: "guvenlik",
    name: "SSL & Güvenlik",
    description: "SSL sertifikaları, DDoS koruma ve siber güvenlik rehberleri",
  },
  {
    slug: "sunucu",
    name: "Sunucu & VPS",
    description: "VPS, VDS ve sunucu altyapısı karşılaştırmaları",
  },
  {
    slug: "eposta",
    name: "E-posta",
    description: "Kurumsal e-posta hosting ve posta sunucusu rehberleri",
  },
  {
    slug: "altyapi",
    name: "Altyapı & CDN",
    description: "CDN, performans optimizasyonu ve altyapı rehberleri",
  },
];

export const kbCategories = [
  {
    slug: "domain-dns",
    name: "Domain & DNS",
    description: "Alan adı ve DNS yönetimi",
    icon: "Globe",
    displayOrder: 1,
  },
  {
    slug: "hosting",
    name: "Hosting",
    description: "Web hosting ve site yönetimi",
    icon: "Server",
    displayOrder: 2,
  },
  {
    slug: "guvenlik",
    name: "Güvenlik",
    description: "SSL, DDoS ve site güvenliği",
    icon: "Shield",
    displayOrder: 3,
  },
  {
    slug: "sunucu",
    name: "Sunucu",
    description: "VPS, VDS ve sunucu hizmetleri",
    icon: "HardDrive",
    displayOrder: 4,
  },
  {
    slug: "eposta",
    name: "E-posta",
    description: "Kurumsal e-posta hizmetleri",
    icon: "Mail",
    displayOrder: 5,
  },
  {
    slug: "performans",
    name: "Performans",
    description: "CDN ve site hızlandırma",
    icon: "Zap",
    displayOrder: 6,
  },
];

/** @typedef {{ slug: string; title: string; excerpt: string; categorySlug: string; kbCategorySlug: string; tags: string[]; metaTitle: string; metaDescription: string; content: string; displayOrder?: number }} SeoArticle */

/** @type {SeoArticle[]} */
export const seoArticles = [
  {
    slug: "domain-kayit-rehberi",
    title: "Domain Kayıt Rehberi: Alan Adı Nasıl Alınır?",
    excerpt:
      "İlk kez domain alacaklar için adım adım rehber: uzantı seçimi, WHOIS, DNS ve KLEACORE üzerinden kayıt süreci.",
    categorySlug: "domain",
    kbCategorySlug: "domain-dns",
    tags: ["domain", "alan adı", "whois", "dns", "kayıt"],
    metaTitle: "Domain Kayıt Rehberi 2026 | Alan Adı Nasıl Alınır? — KLEACORE",
    metaDescription:
      "Domain kaydı nasıl yapılır? Uzantı seçimi, WHOIS gizliliği, DNS ayarları ve güvenli alan adı kaydı için kapsamlı Türkçe rehber.",
    displayOrder: 1,
    content: `Alan adı (domain), markanızın dijital kimliğinin temelidir. Web sitenize, e-posta adreslerinize ve müşteri güveninize doğrudan etki eder. Bu rehberde, KLEACORE üzerinden domain kaydı yaparken dikkat etmeniz gereken tüm adımları, uzantı seçiminden DNS yapılandırmasına kadar detaylı şekilde ele alıyoruz.

## Domain Nedir ve Neden Önemlidir?

Domain, internet üzerindeki benzersiz adresinizdir. Örneğin \`kleacore.com\` bir alan adıdır. Kullanıcılar tarayıcıya bu adresi yazdığında, DNS sistemi sizi doğru sunucuya yönlendirir. Doğru seçilmiş bir domain; marka hatırlanabilirliğini artırır, SEO performansına katkı sağlar ve profesyonel bir imaj oluşturur.

Kısa, telaffuzu kolay ve yazımı net domainler tercih edilmelidir. Türk işletmeler için \`.com.tr\` yerel güven oluştururken, global hedeflerde \`.com\` hâlâ en yaygın tercihtir. Yeni uzantılar (\`.io\`, \`.tech\`, \`.shop\`) ise niş projeler için uygun olabilir.

## Uzantı (TLD) Seçimi

Uzantı seçerken hedef kitlenizi ve sektörünüzü düşünün:

- **.com** — Evrensel, güvenilir, uluslararası projeler için ideal
- **.com.tr / .tr** — Türkiye odaklı işletmeler, yerel SEO avantajı
- **.net / .org** — Teknoloji ve sivil toplum kuruluşları
- **Sektörel uzantılar** — \`.shop\`, \`.blog\`, \`.app\` gibi özel alanlar

Birden fazla uzantıyı koruma altına almak, marka taklitlerini önlemek için akıllıca bir stratejidir. KLEACORE panelinden tüm popüler TLD'leri karşılaştırmalı fiyatlarla inceleyebilirsiniz.

## Domain Müsaitlik Kontrolü

Kayıt öncesinde istediğiniz alan adının müsait olup olmadığını kontrol edin. Müsait değilse alternatif yazımlar veya farklı uzantılar değerlendirin. Tire (\`-\`) kullanımından kaçının; kullanıcılar adresi yanlış yazabilir. Rakam ve özel karakterler de hataya açıktır.

Marka adınızla birebir eşleşen domain bulamazsanız, önek veya sonek eklemek (\`getmarka.com\`, \`markaapp.com\`) geçici çözüm olabilir; ancak uzun vadede ana marka adınızı korumayı hedefleyin.

## Kayıt Süreci: Adım Adım

KLEACORE'da domain kaydı şu adımlarla tamamlanır:

1. **Arama** — İstediğiniz alan adını aratın ve uygun uzantıyı seçin
2. **Sepete ekleme** — Kayıt süresini (1–10 yıl) belirleyin
3. **WHOIS bilgileri** — Doğru iletişim bilgilerini girin (süre dolumu uyarıları için kritik)
4. **Ödeme** — Güvenli ödeme sonrası kayıt otomatik tamamlanır
5. **DNS yönetimi** — Panelden nameserver veya DNS kayıtlarını yapılandırın

Kayıt süresini uzun tutmak, fiyat artışlarından korunmanıza ve alan adınızı kaybetme riskini azaltmanıza yardımcı olur.

## WHOIS Gizliliği

WHOIS, domain sahibinin iletişim bilgilerini kamuya açık tutan bir veritabanıdır. WHOIS gizliliği (privacy protection), kişisel bilgilerinizi spam ve kötüye kullanımdan korur. KLEACORE'da desteklenen TLD'lerde WHOIS gizliliği otomatik veya eklenti olarak sunulabilir; kurumsal projelerde mutlaka aktif edin.

## DNS Temelleri

Domain kaydından sonra sitenizi yayına almak için DNS kayıtları gerekir:

- **A kaydı** — Domain'i sunucu IP adresine yönlendirir
- **CNAME** — Alt domainleri başka bir adrese yönlendirir
- **MX** — E-posta sunucularını tanımlar
- **TXT** — SPF, DKIM ve doğrulama kayıtları için kullanılır

DNS değişiklikleri genellikle 24–48 saat içinde global olarak yayılır (propagation). Hosting satın aldıysanız nameserver'ları hosting sağlayıcınıza yönlendirmek en pratik yöntemdir.

## Sık Yapılan Hatalar

Yanlış e-posta adresiyle kayıt, süre dolumu bildirimlerinin kaçırılmasına yol açar. Otomatik yenilemeyi kapatmak, domain kaybı riskini artırır. Sahte registrar sitelerinden kaçının; yalnızca yetkili kayıt kuruluşları üzerinden işlem yapın.

## Marka ve SEO Açısından Domain Stratejisi

Alan adınız arama motorlarında marka sorgularının büyük bölümünü temsil eder. Eski domainden yeni domaine geçişte 301 yönlendirme planı hazırlayın; aksi halde birikmiş SEO değeri kaybolur. Sosyal medya kullanıcı adları ile domain uyumunu baştan sağlamak, omnichannel marka bütünlüğü oluşturur.

## Sonuç

Doğru domain seçimi ve düzenli yenileme, dijital varlığınızın sürekliliği için vazgeçilmezdir. KLEACORE ile alan adı kaydı, DNS yönetimi ve hosting entegrasyonunu tek panelden yönetebilir; sorularınız için 7/24 destek ekibimize ulaşabilirsiniz.`,
  },
  {
    slug: "hosting-secimi-rehberi",
    title: "Hosting Seçimi Rehberi: Doğru Paket Nasıl Bulunur?",
    excerpt:
      "Paylaşımlı, VPS ve kurumsal hosting arasındaki farklar; trafik, disk ve destek kriterleriyle doğru paket seçimi.",
    categorySlug: "hosting",
    kbCategorySlug: "hosting",
    tags: ["hosting", "web hosting", "paket seçimi", "sunucu"],
    metaTitle: "Hosting Seçimi Rehberi | Doğru Web Hosting Nasıl Seçilir? — KLEACORE",
    metaDescription:
      "Web hosting seçerken nelere dikkat etmelisiniz? Trafik, disk, PHP sürümü, yedekleme ve destek kriterleriyle kapsamlı hosting karşılaştırma rehberi.",
    displayOrder: 2,
    content: `Web hosting, sitenizin 7/24 erişilebilir kalmasını sağlayan altyapıdır. Yanlış paket seçimi yavaş yükleme, kesinti ve güvenlik açıklarına neden olabilir. Bu rehberde, işletmenizin ihtiyaçlarına uygun hosting paketini nasıl belirleyeceğinizi anlatıyoruz.

## Hosting Türleri

Temel hosting modelleri şunlardır:

- **Paylaşımlı hosting** — Birden fazla sitenin aynı sunucuyu paylaştığı ekonomik çözüm; blog ve KOBİ siteleri için ideal
- **WordPress hosting** — CMS için optimize edilmiş kaynak ve önbellek
- **VPS / VDS** — İzole kaynaklar, root erişimi, ölçeklenebilir projeler
- **Dedicated / bulut** — Yüksek trafik ve özel gereksinimler

Başlangıçta paylaşımlı hosting yeterliyken, trafik arttıkça üst pakete veya VPS'e geçiş planlanmalıdır.

## Trafik ve Kaynak İhtiyacı

Aylık ziyaretçi sayınız, sayfa boyutu ve dinamik içerik (PHP, veritabanı) kaynak tüketimini belirler. Küçük kurumsal siteler için 5–10 GB disk ve sınırsız trafik (adil kullanım politikasıyla) genellikle yeterlidir. E-ticaret ve yoğun medya siteleri daha fazla RAM ve CPU gerektirir.

KLEACORE hosting paketlerinde NVMe SSD disk, LiteSpeed veya benzeri web sunucusu ve günlük yedekleme gibi özellikleri karşılaştırarak başlayın.

## Kontrol Paneli ve Kullanım Kolaylığı

cPanel veya Plesk gibi paneller; dosya yönetimi, e-posta, veritabanı ve SSL kurulumunu tek yerden yapmanızı sağlar. Teknik bilginiz sınırlıysa görsel panel ve Türkçe destek öncelikli olmalıdır. SSH erişimi, geliştiriciler için deployment ve bakım kolaylığı sunar.

## Performans ve Uptime

Sayfa hızı hem kullanıcı deneyimi hem SEO için kritiktir. Sunucu lokasyonu (Türkiye veya Avrupa), CDN entegrasyonu ve PHP 8.x desteği performansı doğrudan etkiler. SLA garantili %99,9 uptime, profesyonel projelerde beklenti olmalıdır.

## Güvenlik ve Yedekleme

Günlük otomatik yedekleme, ücretsiz SSL, malware taraması ve DDoS koruması temel güvenlik katmanlarıdır. Yedeklerin geri yüklenebilir olduğundan ve farklı lokasyonda tutulduğundan emin olun. Güncel PHP ve CMS sürümleri güvenlik yamaları için şarttır.

## E-posta ve Domain Entegrasyonu

Hosting paketinizde kaç e-posta hesabı, ne kadar posta kutusu kotası ve SMTP desteği olduğunu kontrol edin. Aynı sağlayıcıdan domain + hosting almak DNS yönetimini basitleştirir.

## Fiyat ve Gizli Maliyetler

Yenileme fiyatları, ilk yıl kampanyasından yüksek olabilir; uzun dönem maliyeti hesaplayın. Ücretsiz migration, SSL ve WHOIS gizliliği değer katar. Sözleşme süresi ve iptal koşullarını okuyun.

## Destek Kalitesi

7/24 ticket, canlı sohbet ve telefon desteği operasyonel riski azaltır. Türkiye saat diliminde hızlı yanıt, yerel işletmeler için avantajdır. KLEACORE destek ekibi hosting, domain ve sunucu konularında uzmanlaşmıştır.

## Geçiş (Migration) Planı

Mevcut hostingden taşınırken dosya, veritabanı ve e-posta aktarımını planlayın. Profesyonel ücretsiz taşıma hizmeti sunan sağlayıcılar kesinti süresini minimize eder. DNS TTL değerini taşıma öncesi düşürerek geçişi hızlandırabilirsiniz.

## PHP, Veritabanı ve Teknik Uyumluluk

Kullandığınız CMS veya framework'ün minimum PHP sürümünü hosting panelinden doğrulayın. MariaDB/MySQL sürümü, InnoDB desteği ve max_connections limiti yoğun e-ticaret sitelerinde önem kazanır. ionCube veya özel PHP eklentisi gerekiyorsa önceden destek ekibine danışın; uyumsuzluk canlıya geçişte sürpriz yaratır.

## Ölçekleme ve Gelecek Planlaması

Bugün küçük bir vitrin sitesi kuruyor olsanız bile, 12–24 ay içinde trafik ve özellik ihtiyacı değişebilir. Hosting sağlayıcınızın paket yükseltme, kaynak artırımı ve sunucu tipi değişimi (paylaşımlı → VPS) süreçlerini önceden sorun. Kesintisiz yükseltme imkânı, büyüme dönemlerinde operasyonel riski azaltır. KLEACORE müşteri panelinden anlık kaynak kullanımını izleyerek proaktif karar verebilirsiniz.

## Sonuç

Hosting seçimi proje büyüklüğü, bütçe ve teknik gereksinimlerin dengesidir. KLEACORE'da Linux, WordPress ve kurumsal hosting paketlerini karşılaştırarak ihtiyacınıza uygun çözümü seçebilir; gerektiğinde VPS veya VDS'e sorunsuz yükseltebilirsiniz.`,
  },
  {
    slug: "ssl-sertifikasi-turleri",
    title: "SSL Sertifikası Türleri: DV, OV ve EV Karşılaştırması",
    excerpt:
      "Domain Validation, Organization Validation ve Extended Validation SSL farkları; hangi sertifikayı ne zaman kullanmalısınız?",
    categorySlug: "guvenlik",
    kbCategorySlug: "guvenlik",
    tags: ["ssl", "https", "dv", "ov", "ev", "wildcard"],
    metaTitle: "SSL Sertifikası Türleri | DV, OV, EV ve Wildcard — KLEACORE",
    metaDescription:
      "SSL sertifikası türleri nelerdir? DV, OV, EV ve Wildcard SSL arasındaki farklar, fiyat ve kullanım senaryoları için detaylı rehber.",
    displayOrder: 3,
    content: `SSL (TLS) sertifikaları, web siteniz ile ziyaretçi arasındaki veriyi şifreleyerek güvenli HTTPS bağlantısı sağlar. Google HTTPS'i sıralama sinyali olarak kullanır; tarayıcılar HTTP sitelerini "güvenli değil" olarak işaretler. Bu rehberde SSL türlerini ve hangi projede hangisini tercih etmeniz gerektiğini açıklıyoruz.

## SSL Nasıl Çalışır?

SSL/TLS, sunucu ile istemci arasında şifreli bir tünel kurar. Sertifika, domainin (ve isteğe bağlı kuruluşun) doğrulanmış kimliğini içerir. Tarayıcı adres çubuğunda kilit simgesi görünür; kullanıcı güveni ve ödeme formları için zorunludur.

## Domain Validation (DV) SSL

DV sertifikaları yalnızca domain sahipliğini doğrular. Doğrulama genellikle e-posta, DNS TXT kaydı veya HTTP dosyası ile dakikalar içinde tamamlanır. Kişisel bloglar, portfolyolar ve küçük işletme siteleri için yeterlidir.

**Avantajlar:** Hızlı kurulum, düşük maliyet, otomatik yenileme (Let's Encrypt veya ticari DV)
**Dezavantajlar:** Kuruluş adı sertifikada görünmez; yüksek güven gerektiren finans uygulamaları için sınırlı

KLEACORE hosting paketlerinde birçok site için ücretsiz DV SSL (AutoSSL) sunulmaktadır.

## Organization Validation (OV) SSL

OV sertifikalarında sertifika otoritesi (CA), şirketin yasal varlığını doğrular. Sertifika detaylarında kuruluş adı yer alır. B2B portallar, intranet ve orta ölçekli e-ticaret için uygundur.

Doğrulama birkaç iş günü sürebilir; ticari sicil belgesi ve telefon doğrulaması istenebilir. DV'ye göre daha yüksek güven seviyesi sunar.

## Extended Validation (EV) SSL

EV SSL, en kapsamlı kurumsal doğrulamayı içerir. Eskiden tarayıcılarda yeşil adres çubuğu ile gösterilirdi; günümüzde güçlü kimlik doğrulama ve detaylı CA incelemesi ile öne çıkar. Bankalar, büyük e-ticaret ve kamu kurumları tercih eder.

Maliyet ve süreç OV'den yüksektir; ancak phishing saldırılarına karşı marka güveni sağlar.

## Wildcard ve Multi-Domain SSL

**Wildcard SSL** — \`*.example.com\` formatında tüm alt domainleri tek sertifikayla korur. API, panel ve blog alt alanları için pratiktir.

**Multi-Domain (SAN)** — Birden fazla farklı domain veya alt domain tek sertifikada toplanır. Holding yapıları ve çoklu marka projeleri için idealdir.

## SSL Süresi ve Otomatik Yenileme

Sertifikalar genellikle 1 yıllık verilir (maksimum 398 gün). Süresi dolan SSL, tarayıcı uyarılarına ve SEO kaybına yol açar. Otomatik yenileme ve süre dolumu bildirimlerini aktif tutun. KLEACORE panelinden SSL durumunu ve bitiş tarihlerini izleyebilirsiniz.

## Kurulum ve Karışık İçerik

SSL kurulduktan sonra tüm kaynakların (görsel, script, CSS) HTTPS üzerinden yüklendiğinden emin olun. Karışık içerik (mixed content) kilit simgesini kırar. WordPress ve diğer CMS'lerde "Site URL" ayarını HTTPS olarak güncelleyin; 301 yönlendirme ekleyin.

## Hangi SSL'i Seçmelisiniz?

| Senaryo | Önerilen tür |
| Kişisel site / blog | DV (ücretsiz veya standart) |
| Kurumsal web sitesi | OV |
| E-ticaret / ödeme | OV veya EV |
| Çoklu alt domain | Wildcard DV/OV |

## Sertifika Şeffaflığı ve HSTS

Certificate Transparency logları, yanlışlıkla veya kötü niyetle verilen sertifikaların tespitini kolaylaştırır. HSTS (HTTP Strict Transport Security) başlığı, tarayıcının siteyi yalnızca HTTPS üzerinden açmasını zorlar ve downgrade saldırılarını engeller. Bu ayarları SSL kurulumundan sonra sunucu veya CDN panelinden etkinleştirin.

## PCI-DSS ve Regülasyon Uyumu

Ödeme kartı verisi işleyen siteler PCI-DSS kapsamında güçlü şifreleme ve sertifika yönetimi gerektirir. KVKK ve GDPR kapsamında kişisel veri formları da HTTPS üzerinden sunulmalıdır. Sertifika yenileme takvimini operasyon ekibinize atayın; süresi dolmuş SSL, hem uyumluluk hem de müşteri güveni açısından ciddi risktir.

## Sonuç

SSL artık lüks değil, zorunluluktur. Projenizin güven ve uyumluluk gereksinimlerine göre DV, OV veya EV seçin; wildcard ihtiyacınızı önceden planlayın. KLEACORE SSL ürünleri ve hosting entegrasyonu ile dakikalar içinde HTTPS'e geçebilirsiniz.`,
  },
  {
    slug: "vps-vs-vds-farki",
    title: "VPS vs VDS Farkı: Hangi Sunucu Modeli Size Uygun?",
    excerpt:
      "Sanal özel sunucu ile sanal adanmış sunucu arasındaki kaynak ayrımı, performans ve kullanım senaryoları.",
    categorySlug: "sunucu",
    kbCategorySlug: "sunucu",
    tags: ["vps", "vds", "sunucu", "sanal sunucu", "kvm"],
    metaTitle: "VPS vs VDS Farkı Nedir? | Sunucu Seçim Rehberi — KLEACORE",
    metaDescription:
      "VPS ile VDS arasındaki farklar nelerdir? Kaynak garantisi, performans, fiyat ve hangi projede hangi sunucu tipini seçmeniz gerektiği.",
    displayOrder: 4,
    content: `VPS (Virtual Private Server) ve VDS (Virtual Dedicated Server) terimleri sıkça karıştırılır. Her ikisi de fiziksel bir sunucunun sanallaştırılarak bölünmesiyle oluşur; ancak kaynak ayrımı, performans garantisi ve fiyatlandırma açısından farklılık gösterirler. Doğru modeli seçmek, uygulama stabilitesi ve maliyet verimliliği için kritiktir.

## Sanallaştırma Temelleri

Modern sunucularda KVM, VMware veya Hyper-V gibi teknolojilerle her sanal makine (VM) izole çalışır. CPU, RAM ve disk I/O paylaşımlı veya garantili olabilir. Bu ayrım VPS ile VDS'i birbirinden ayıran temel faktördür.

## VPS (Virtual Private Server) Nedir?

VPS'te sunucu kaynakları **paylaşımlı** havuzdan gelir. Size ayrılan RAM ve CPU çekirdeği vardır; ancak aynı fiziksel makinedeki diğer VPS'ler yoğunluk yarattığında "noisy neighbor" etkisi görülebilir. Disk I/O ve ağ bant genişliği de paylaşımlı olabilir.

**Uygun olduğu durumlar:**
- Geliştirme ve test ortamları
- Orta trafikli web siteleri ve API'ler
- Bütçe odaklı startup projeleri
- Docker ile hafif konteyner iş yükleri

KLEACORE VPS paketleri NVMe disk ve Türkiye lokasyonu ile dengeli fiyat/performans sunar.

## VDS (Virtual Dedicated Server) Nedir?

VDS'te kaynaklar **garanti altındadır**. Ayrılan RAM ve CPU başka müşterilerle paylaşılmaz; disk I/O ve ağ performansı daha öngörülebilirdir. Bazı sağlayıcılarda VDS terimi, dedicated kaynaklı KVM VM anlamına gelir.

**Uygun olduğu durumlar:**
- E-ticaret ve yüksek trafikli uygulamalar
- Veritabanı sunucuları (MySQL, PostgreSQL)
- Gerçek zamanlı uygulamalar ve oyun sunucuları
- SLA gerektiren kurumsal projeler

VDS genellikle VPS'ten daha yüksek fiyatlıdır; ancak kesinti ve yavaşlama riski daha düşüktür.

## Karşılaştırma Tablosu

| Özellik | VPS | VDS |
| Kaynak garantisi | Sınırlı / paylaşımlı | Garantili / izole |
| Performans öngörülebilirliği | Orta | Yüksek |
| Fiyat | Daha ekonomik | Daha yüksek |
| Ölçekleme | Kolay yükseltme | Kolay yükseltme |
| Root erişimi | Evet | Evet |

## İşletim Sistemi ve Yönetim

Her iki modelde de Linux (Ubuntu, AlmaLinux, Debian) veya Windows Server seçebilirsiniz. Yönetimli hizmetlerde güncelleme, güvenlik duvarı ve yedekleme sağlayıcı tarafından yapılır; yönetimsiz sunucularda tam kontrol sizdedir.

## Ağ ve Güvenlik

Dedicated IP, IPv6, DDoS koruması ve özel VLAN seçeneklerini değerlendirin. VDS üzerinde yoğun veritabanı trafiği için düşük gecikmeli (low latency) lokasyon seçimi önemlidir. KLEACORE veri merkezi hizmetleri ile colocation ve ek koruma katmanları eklenebilir.

## Ne Zaman VPS, Ne Zaman VDS?

Trafik düşük-orta seviyedeyse ve maliyet öncelikliyse VPS yeterlidir. Black Friday kampanyaları, canlı yayın veya kritik ERP sistemleri için VDS veya fiziksel sunucu düşünün. Monitoring kurarak CPU, RAM ve disk kullanımını izleyin; sürekli %80+ kullanımda üst pakete geçin.

## Yedekleme ve Felaket Kurtarma

Snapshot ve günlük yedekleme her iki modelde de yapılandırılmalıdır. VDS'te tutarlı yedekleme pencereleri daha öngörülebilir I/O ile daha hızlı tamamlanabilir. Yedekleri farklı lokasyonda veya object storage'da saklayın.

## Maliyet Optimizasyonu İpuçları

Kaynak izleme araçlarıyla boşta kalan CPU ve RAM'i tespit edin; aşırı satın alma (over-provisioning) bütçeyi gereksiz yere tüketir. Tersine, sürekli throttling yaşıyorsanız VDS'e geçiş uzun vadede daha ekonomik olabilir — kesinti maliyeti fiyat farkından yüksekse garantili kaynak tercih edin. Reserved veya yıllık faturalama seçenekleri aylık ödemeye göre indirim sunabilir.

## Sonuç

VPS ekonomik esneklik, VDS ise garantili performans sunar. Projenizin trafik profilini ve iş sürekliliği gereksinimlerini analiz ederek KLEACORE VPS veya VDS paketlerinden size uygun olanı seçin. Gerekirse bulut veya dedicated sunucuya geçiş için destek ekibimiz migration planlamasında yardımcı olur.`,
  },
  {
    slug: "wordpress-hosting-rehberi",
    title: "WordPress Hosting Rehberi: Hızlı ve Güvenli WP Sitesi",
    excerpt:
      "WordPress için optimize hosting özellikleri: LiteSpeed, Redis, otomatik güncelleme, staging ve güvenlik ipuçları.",
    categorySlug: "hosting",
    kbCategorySlug: "hosting",
    tags: ["wordpress", "wp hosting", "litespeed", "cms"],
    metaTitle: "WordPress Hosting Rehberi | Hızlı WP Sitesi Nasıl Kurulur? — KLEACORE",
    metaDescription:
      "WordPress hosting nedir? LiteSpeed, PHP 8, Redis önbellek ve güvenlik ile optimize WordPress sitesi kurulum rehberi.",
    displayOrder: 5,
    content: `WordPress, dünya genelinde en çok kullanılan içerik yönetim sistemidir. Genel paylaşımlı hosting WordPress'i çalıştırabilir; ancak WP'ye özel optimize edilmiş hosting, hız, güvenlik ve yönetim kolaylığı sağlar. Bu rehberde WordPress hosting seçerken ve siteyi optimize ederken bilmeniz gerekenleri paylaşıyoruz.

## WordPress Hosting Nedir?

WordPress hosting; PHP sürümü, veritabanı, önbellek ve sunucu yapılandırmasının CMS için ayarlandığı hosting türüdür. Tek tıkla kurulum, otomatik çekirdek güncellemeleri, staging ortamı ve WP odaklı destek sunulabilir. WooCommerce mağazaları için ek kaynak (RAM, CPU) ayrılması yaygındır.

## Sunucu Gereksinimleri

WordPress resmi minimum gereksinimleri: PHP 7.4+ (PHP 8.2+ önerilir), MySQL 5.7+ veya MariaDB 10.4+, HTTPS desteği. Üretim ortamında en az 512 MB PHP memory_limit; yoğun sitelerde 256 MB ve üzeri WordPress bellek limiti önerilir.

KLEACORE WordPress hosting paketlerinde güncel PHP, MariaDB ve ücretsiz SSL standarttır.

## Performans Optimizasyonu

**Önbellek katmanları:**
- Sunucu seviyesi (LiteSpeed Cache, OPcache)
- Nesne önbelleği (Redis veya Memcached)
- Sayfa önbelleği eklentileri (LiteSpeed Cache, WP Super Cache)

Görsel optimizasyonu (WebP, lazy load), CDN kullanımı ve gereksiz eklenti sayısını azaltmak Core Web Vitals skorlarını iyileştirir. Veritabanı optimizasyonu ve düzenli revision temizliği de hız kazandırır.

## Güvenlik En İyi Uygulamaları

- Yönetici kullanıcı adını "admin" yapmayın
- İki faktörlü kimlik doğrulama (2FA) kullanın
- Eklenti ve temaları güncel tutun; kullanılmayanları silin
- \`wp-config.php\` dosyasında güvenlik anahtarlarını düzenli yenileyin
- WAF ve malware taraması aktif olsun

KLEACORE altyapısında sunucu seviyesi güvenlik duvarı ve düzenli yedekleme WordPress sitelerini korur.

## Staging ve Güncelleme Stratejisi

Canlı siteyi etkilemeden eklenti ve tema güncellemelerini test etmek için staging ortamı kullanın. Önce staging'de test, ardından canlıya alma iş akışı kesintileri önler. Büyük güncellemeler öncesi tam yedek alın.

## WooCommerce ve E-ticaret

E-ticaret siteleri daha fazla eşzamanlı oturum ve veritabanı sorgusu üretir. SSL zorunludur; ödeme ağ geçitleri (iyzico, Stripe) HTTPS gerektirir. Yüksek trafik dönemlerinde geçici kaynak artırımı veya üst hosting paketine geçiş planlayın.

## Migrasyon: Mevcut WP Sitesini Taşıma

All-in-One WP Migration, Duplicator veya manuel FTP + phpMyAdmin ile taşıma yapılabilir. KLEACORE ücretsiz site taşıma hizmeti ile DNS değişikliği sonrası kısa kesintiyle geçiş sağlanır. \`siteurl\` ve \`home\` değerlerini yeni domain'e göre güncellemeyi unutmayın.

## Yedekleme ve Kurtarma

Günlük otomatik yedekleme + manuel yedek (güncelleme öncesi) kombinasyonu idealdir. Veritabanı ve \`wp-content\` klasörü birlikte yedeklenmelidir. Off-site yedek, ransomware riskine karşı ek koruma sağlar.

## SEO ve WordPress

Kalıcı bağlantı yapısını (permalink) SEO dostu seçin (\`/yazi-basligi/\`). Rank Math veya Yoast ile meta açıklamaları yönetin. Site haritası ve robots.txt'yi yapılandırın. Hızlı hosting + optimize tema, arama sıralamasına doğrudan katkı sağlar.

## Tema ve Eklenti Seçimi

Hafif, güncel ve iyi derecelendirilmiş temalar Core Web Vitals skorunu doğrudan etkiler. Her eklenti ek HTTP isteği ve PHP yükü getirir; yalnızca gerekli eklentileri aktif tutun. Gutenberg blok editörü ve full-site editing (FSE) temaları modern WordPress projelerinde tercih edilmektedir.

## Çoklu Site ve Ajans Kullanımı

Ajanslar birden fazla müşteri sitesini yönetiyorsa, reseller veya çoklu site hosting planları değerlendirilmelidir. Her site için ayrı staging, ayrı SSL ve izole dosya yapısı güvenlik sağlar. Git tabanlı deployment veya WP-CLI ile toplu güncelleme, operasyonel verimliliği artırır.

## Sonuç

WordPress hosting, genel hostingden daha iyi performans ve WP odaklı araçlar sunar. KLEACORE WordPress paketleri ile tek tıkla kurulum, LiteSpeed önbellek ve uzman destek alarak sitenizi hızlı ve güvenli şekilde yayına alabilirsiniz.`,
  },
  {
    slug: "eposta-hosting-rehberi",
    title: "E-posta Hosting Rehberi: Kurumsal Posta Nasıl Kurulur?",
    excerpt:
      "Özel domain ile kurumsal e-posta: MX kayıtları, SPF/DKIM/DMARC, kota ve güvenli posta sunucusu yapılandırması.",
    categorySlug: "eposta",
    kbCategorySlug: "eposta",
    tags: ["e-posta", "kurumsal mail", "mx", "spf", "dkim"],
    metaTitle: "E-posta Hosting Rehberi | Kurumsal E-posta Kurulumu — KLEACORE",
    metaDescription:
      "E-posta hosting nedir? MX, SPF, DKIM, DMARC ayarları ve özel domain ile profesyonel kurumsal e-posta kurulum rehberi.",
    displayOrder: 6,
    content: `Gmail veya genel servisler kişisel kullanım için yeterlidir; ancak \`info@sirketiniz.com\` formatındaki kurumsal e-posta, marka güvenilirliğini artırır. E-posta hosting, özel domain üzerinden posta kutuları, takvim ve güvenli iletim altyapısı sağlar. Bu rehberde kurumsal e-posta kurulumunu adım adım anlatıyoruz.

## Neden Kurumsal E-posta?

- **Profesyonellik** — Müşteriler markanıza güvenir
- **Marka tutarlılığı** — Her çalışan aynı domain uzantısını kullanır
- **Kontrol** — Hesap açma/kapama, kota ve arşivleme sizin elinizde
- **Teslimat oranı** — Doğru SPF/DKIM ile spam klasörüne düşme riski azalır

Ücretsiz e-posta sağlayıcıları iş kullanımında sınırlı destek ve depolama sunar; kurumsal hosting ölçeklenebilir çözüm sağlar.

## E-posta Hosting Türleri

1. **Hosting paketi içi e-posta** — Web hosting ile birlikte gelen posta kutuları (küçük ekipler)
2. **Dedicated e-posta hosting** — Yüksek kota ve gelişmiş filtreleme
3. **Bulut posta (Google Workspace, Microsoft 365)** — Harici sağlayıcı, domain DNS ile bağlanır

KLEACORE hosting ve kurumsal e-posta paketleri KOBİ'ler için uygun maliyetli çözümler sunar.

## DNS Kayıtları: MX, SPF, DKIM, DMARC

**MX (Mail Exchange)** — Gelen postanın hangi sunucuya yönleneceğini belirler. Öncelik (priority) değeri düşük olan kayıt önce denenir.

**SPF (Sender Policy Framework)** — Hangi sunucuların sizin adınıza posta gönderebileceğini TXT kaydıyla tanımlar. SPF kaydı olmadan iletiler spam olarak işaretlenebilir.

**DKIM** — E-postaya kriptografik imza ekler; alıcı sunucu mesajın değiştirilmediğini doğrular.

**DMARC** — SPF ve DKIM sonuçlarına göre sahte e-postalara karşı politika uygular (none, quarantine, reject).

Bu dört kayıt doğru yapılandırılmadan toplu e-posta ve müşteri iletişimi güvenilir olmaz.

## Posta Kutusu Kotası ve Limitler

Kullanıcı başına kota (ör. 5 GB, 25 GB), gönderim limiti (saatlik/günlük) ve ek dosya boyutu sınırlarını planlayın. Arşivleme ihtiyacı olan sektörlerde (hukuk, finans) sınırsız arşiv veya ek depolama seçeneklerini değerlendirin.

## İstemci Yapılandırması

Masaüstü (Outlook, Thunderbird) ve mobil cihazlarda IMAP/SMTP veya Exchange ActiveSync kullanın:

- **IMAP** — Çoklu cihaz senkronizasyonu (önerilen)
- **SMTP** — Gönderim; genellikle 587 (TLS) veya 465 (SSL) portu
- **Webmail** — Tarayıcıdan erişim, seyahatte pratik

Güçlü parola ve 2FA zorunlu tutun; ortak hesaplarda (info@, destek@) erişim loglarını izleyin.

## Spam ve Virüs Filtreleme

Sunucu seviyesi greylisting, RBL kontrolü ve ClamAV benzeri antivirüs taraması gelen postayı korur. Giden postada rate limiting, IP itibarını korur. Phishing farkındalık eğitimi çalışanlar için kritiktir.

## Yedekleme ve Uyumluluk

E-posta yedekleri yasal saklama süreleri (KVKK, sektörel düzenlemeler) için gerekebilir. Otomatik yedekleme ve export (PST, mbox) seçeneklerini kontrol edin. Silinen postaların kurtarılabilir olduğu süreyi (retention) ayarlayın.

## Göç (Migration) Mevcut Postadan

Eski sağlayıcıdan IMAP migration araçlarıyla posta kutularını taşıyın. DNS MX kaydını düşük TTL ile güncelleyerek kesintiyi minimize edin. Geçiş sırasında hem eski hem yeni sunucuya posta almak için geçici çift MX yapılandırması mümkündür.

## Toplu E-posta ve Pazarlama Gönderimleri

Bülten ve kampanya e-postaları için ayrı bir gönderim altyapısı (transactional vs marketing) kullanmak IP itibarını korur. SPF kaydına yalnızca yetkili gönderim sunucularını ekleyin; paylaşımlı hosting IP'sinden toplu gönderim spam skorunu düşürebilir. Dedicated IP veya profesyonel e-posta pazarlama servisi entegrasyonu büyük listeler için önerilir.

## Sonuç

Kurumsal e-posta, dijital iletişimin temel taşıdır. KLEACORE e-posta hosting ile özel domain posta kutuları oluşturabilir, SPF/DKIM/DMARC rehberliği ile teslimat kalitesini artırabilirsiniz. Teknik sorularınız için destek ekibimiz DNS kayıt kontrolünde yardımcı olur.`,
  },
  {
    slug: "ddos-koruma-rehberi",
    title: "DDoS Koruma Rehberi: Web Sitenizi Saldırılardan Nasıl Korursunuz?",
    excerpt:
      "Dağıtık hizmet dışı bırakma saldırıları, koruma katmanları, scrubbing merkezleri ve KLEACORE DDoS çözümleri.",
    categorySlug: "guvenlik",
    kbCategorySlug: "guvenlik",
    tags: ["ddos", "siber güvenlik", "waf", "koruma"],
    metaTitle: "DDoS Koruma Nedir? | Web Sitesi DDoS Koruma Rehberi — KLEACORE",
    metaDescription:
      "DDoS saldırısı nedir ve nasıl önlenir? Volumetrik, protokol ve uygulama katmanı koruması için kapsamlı DDoS koruma rehberi.",
    displayOrder: 7,
    content: `DDoS (Distributed Denial of Service) saldırıları, web sitenizi veya sunucunuzu aşırı trafikle hedef alarak hizmet dışı bırakmayı amaçlar. E-ticaret, finans ve medya siteleri yoğun saldırı tehdidi altındadır. Bu rehberde DDoS türlerini, koruma stratejilerini ve KLEACORE altyapısındaki çözümleri inceliyoruz.

## DDoS Saldırısı Nasıl Çalışır?

Saldırganlar, ele geçirilmiş cihazlardan (botnet) veya amplifikasyon tekniklerinden gelen milyonlarca istekle sunucu bant genişliğini, bağlantı tablosunu veya uygulama kaynaklarını tüketir. Sonuç: site yavaşlar, zaman aşımı verir veya tamamen erişilemez hale gelir. Gelir kaybı, itibar zedelenmesi ve SLA ihlalleri doğurur.

## Saldırı Türleri

**Volumetrik (L3/L4)** — UDP flood, DNS amplification; bant genişliğini doldurur. Gbps–Tbps ölçeğinde olabilir.

**Protokol saldırıları** — SYN flood, Ping of Death; TCP/IP stack'i zorlar.

**Uygulama katmanı (L7)** — HTTP flood, Slowloris; gerçekçi isteklerle web sunucusunu yorar. Tespit edilmesi daha zordur.

Karma (multi-vector) saldırılar birden fazla katmanı aynı anda hedefler.

## Temel Koruma Adımları

1. **Yeterli bant genişliği ve ölçeklenebilir altyapı** — Ani trafik sıçramalarına dayanıklılık
2. **Rate limiting** — IP ve oturum başına istek sınırı
3. **Web Application Firewall (WAF)** — Kötü niyetli istekleri filtreleme
4. **CDN ile dağıtık önbellek** — Kaynak sunucuya gelen trafiği azaltma
5. **Anycast ağı** — Trafiği coğrafi olarak dağıtılmış scrubbing merkezlerine yönlendirme

Tek başına ev tipi firewall veya küçük VPS, büyük volumetrik saldırılara dayanamaz; upstream koruma şarttır.

## Scrubbing Merkezi ve Bulut Koruma

Scrubbing merkezleri, gelen trafiği analiz ederek meşru trafiği ayırır, saldırı trafiğini temizler. Bulut tabanlı DDoS koruma, saldırı anında kapasiteyi otomatik artırır. KLEACORE veri merkezi ürünleri arasında DDoS koruma paketleri, Türkiye ve uluslararası hatlarda filtreleme sunar.

## Sunucu ve Ağ Yapılandırması

- SYN cookies ve bağlantı timeout ayarları
- Gereksiz portları kapatma; yalnızca 80/443 açık
- Fail2ban veya benzeri brute-force önleme
- Nginx/Apache timeout ve worker limitleri

Uygulama tarafında CAPTCHA, challenge sayfaları ve bot skorlama (JavaScript challenge) L7 saldırılarını yavaşlatır.

## İzleme ve Müdahale Planı

7/24 trafik izleme, anomali uyarıları ve runbook hazırlayın. Saldırı anında: iletişim zinciri, DNS/CDN üzerinden blackhole veya mitigation modu, müşteri bilgilendirmesi. Olay sonrası analiz (post-mortem) tekrarı önlemek için öğrenilen dersleri dokümante edin.

## Yasal ve Sözleşmesel Boyut

Hosting sözleşmenizde DDoS mitigation kapsamını okuyun. Bazı paketler temel koruma sunar; enterprise saldırılar için ek koruma ücreti gerekebilir. Siber sigorta, büyük işletmelerde ek risk transferi sağlar.

## Maliyet-Fayda Analizi

Küçük bloglar için temel CDN + hosting koruması yeterli olabilir. E-ticaret ve fintech için dedicated DDoS koruma yatırımı, bir saatlik kesinti maliyetinden düşük kalabilir. Risk skorunuza göre katmanlı savunma (defense in depth) uygulayın.

## Küçük Siteler İçin Pratik Önlemler

Her ölçekteki site temel hijyen kurallarına uymalıdır: güncel yazılım, güçlü parolalar, gereksiz servislerin kapatılması ve Cloudflare gibi ücretsiz katmanların değerlendirilmesi. Küçük bloglar bile otomatik tarama botları tarafından hedef alınır; asgari koruma maliyetsiz adımlarla başlar.

## Saldırı Sonrası İyileştirme

Saldırı geçtikten sonra log analizi yaparak saldırı vektörünü belgeleyin. Zayıf noktaları (açık UDP portları, eski TLS sürümleri, rate limit eksikliği) kapatın. Müşteri ve paydaşlara şeffaf iletişim, itibar yönetiminin parçasıdır. Tekrarlayan saldırılarda upstream sağlayıcı ile kapasite artırımı ve coğrafi filtreleme seçeneklerini değerlendirin.

## Sonuç

DDoS koruması reaktif değil, proaktif planlama gerektirir. KLEACORE DDoS koruma ve CDN hizmetleri ile sitenizi volumetrik ve uygulama katmanı tehditlerine karşı güçlendirebilir; uzman ekibimiz saldırı anında mitigation desteği sağlar.`,
  },
  {
    slug: "cdn-nedir-rehberi",
    title: "CDN Nedir? İçerik Dağıtım Ağı ile Site Hızlandırma",
    excerpt:
      "CDN çalışma prensibi, edge önbellek, Türkiye PoP noktaları ve SEO'ya etkisi; ne zaman CDN kullanmalısınız?",
    categorySlug: "altyapi",
    kbCategorySlug: "performans",
    tags: ["cdn", "performans", "önbellek", "edge", "hız"],
    metaTitle: "CDN Nedir? | İçerik Dağıtım Ağı Rehberi — KLEACORE",
    metaDescription:
      "CDN (Content Delivery Network) nedir, nasıl çalışır? Site hızlandırma, bant genişliği tasarrufu ve SEO için CDN kullanım rehberi.",
    displayOrder: 8,
    content: `CDN (Content Delivery Network / İçerik Dağıtım Ağı), statik ve dinamik içeriği kullanıcıya coğrafi olarak yakın sunuculardan (edge/PoP) sunarak gecikmeyi azaltır. Global ziyaretçisi olan veya yoğun medya barındıran siteler için CDN, performans ve maliyet optimizasyonunun temel aracıdır.

## CDN Nasıl Çalışır?

Kaynak sunucunuz (origin) içeriği üretir; CDN edge sunucuları bu içeriği önbelleğe alır. Kullanıcı siteye girdiğinde DNS, en yakın PoP noktasına yönlendirir. Önbellekte varsa içerik origin'e gitmeden sunulur; yoksa origin'den çekilip edge'de saklanır. TTL (time-to-live) süresi dolunca içerik yenilenir.

## CDN'in Faydaları

- **Düşük gecikme (latency)** — Sayfa yükleme süresi kısalır
- **Origin yükü azalır** — Bant genişliği ve CPU tasarrufu
- **Yüksek erişilebilirlik** — Bir PoP arızalansa diğerleri devreye girer
- **DDoS emilimi** — Dağıtık altyapı saldırı trafiğini dağıtır
- **SEO** — Core Web Vitals ve mobil deneyim iyileşir

## Hangi İçerikler CDN'de Önbelleklenir?

İdeal adaylar: görseller, CSS, JavaScript, fontlar, video (VOD), indirilebilir dosyalar. Dinamik HTML, oturum tabanlı sayfalar ve API yanıtları önbelleklenmesi daha zordur; ancak edge computing ve akıllı cache kuralları ile kısmen optimize edilebilir.

Cache-Control ve ETag başlıklarını doğru ayarlayın. WooCommerce sepet ve giriş sayfaları önbellek dışı bırakılmalıdır.

## CDN Türleri

**Pull CDN** — İlk istekte origin'den çeker, sonraki isteklerde edge'den sunar. Kurulumu kolay; çoğu site için yeterli.

**Push CDN** — İçeriği siz edge'e yüklersiniz; büyük dosya dağıtımı ve oyun patch'leri için uygun.

**Multi-CDN** — Birden fazla sağlayıcı ile yedeklilik ve en iyi rota seçimi.

KLEACORE CDN hizmeti, Türkiye ve Avrupa PoP'ları ile yerel ziyaretçiler için optimize edilmiş gecikme sunar.

## Kurulum Adımları

1. CDN sağlayıcısında site/domain ekleyin
2. Origin sunucu adresini (A/CNAME) tanımlayın
3. DNS'te CNAME veya nameserver değişikliği yapın
4. SSL sertifikasını CDN üzerinde etkinleştirin (Full Strict önerilir)
5. Önbellek kuralları ve sıkıştırma (Brotli/Gzip) ayarlayın

Propagasyon sonrası TTFB ve LCP metriklerini ölçerek iyileşmeyi doğrulayın.

## SSL ve CDN

CDN, ziyaretçi ile edge arasında HTTPS sağlar. Origin bağlantısı da şifreli olmalıdır (Full SSL). Sertifika yönetimi için CDN'in ücretsiz SSL'i veya Let's Encrypt entegrasyonu kullanılabilir.

## Maliyet Modeli

Trafik (GB), istek sayısı ve bölgeye göre ücretlendirme yaygındır. Önbellek isabet oranı (cache hit ratio) yükseldikçe origin maliyeti düşer. Medya ağırlıklı sitelerde CDN, origin bant genişliği maliyetinden daha ucuz olabilir.

## Yaygın Hatalar

- Tüm siteyi agresif önbelleğe alıp dinamik içeriği bozmak
- Query string'leri yanlış yönetmek (cache poison riski)
- Purge işlemini güncelleme sonrası unutmak
- Origin IP'nin ifşa edilmesi (bypass saldırıları)

Origin'i yalnızca CDN IP'lerinden kabul edecek şekilde firewall kuralları ekleyin.

## CDN Olmadan Optimizasyon

CDN kullanmasanız bile görsel sıkıştırma, HTTP/2, lazy load ve sunucu önbelleği uygulayın. Ancak uluslararası ziyaretçide fiziksel mesafe sınırı vardır; CDN coğrafi engeli ortadan kaldırır.

## Mobil ve Video İçerik

Mobil kullanıcı oranı yüksek sitelerde edge'de görsel yeniden boyutlandırma (image optimization) ve adaptive bitrate video sunumu CDN'in en değerli özelliklerindendir. Türkiye'deki ziyaretçiler için yerel PoP, özellikle akşam saatlerinde yoğun trafikte belirgin hız artışı sağlar.

## Performans Ölçümü ve Sürekli İyileştirme

CDN kurulumundan önce ve sonra Google PageSpeed Insights, WebPageTest veya Lighthouse ile metrik toplayın. Cache hit ratio %90 üzerine çıktığında origin maliyeti belirgin düşer. A/B testleri ile farklı TTL ve sıkıştırma ayarlarını karşılaştırarak en iyi yapılandırmayı bulun.

## Sonuç

CDN, modern web performansının standart bileşenidir. KLEACORE CDN çözümleri ile sitenizi hızlandırabilir, origin yükünü azaltabilir ve kullanıcı deneyimini küresel ölçekte iyileştirebilirsiniz. Teknik kurulum için destek ekibimiz DNS ve SSL adımlarında rehberlik sağlar.`,
  },
  {
    slug: "domain-transfer-rehberi",
    title: "Domain Transfer Rehberi: Alan Adını Başka Registrar'a Taşıma",
    excerpt:
      "EPP/auth code, 60 gün kuralı, nameserver değişikliği ve KLEACORE'a sorunsuz domain transferi adımları.",
    categorySlug: "domain",
    kbCategorySlug: "domain-dns",
    tags: ["domain transfer", "epp", "auth code", "registrar"],
    metaTitle: "Domain Transfer Rehberi | Alan Adı Transferi Nasıl Yapılır? — KLEACORE",
    metaDescription:
      "Domain transferi nasıl yapılır? Auth code, kilidi kaldırma, 60 gün kuralı ve KLEACORE'a alan adı taşıma rehberi.",
    displayOrder: 9,
    content: `Domain transferi, alan adınızın yönetimini bir kayıt kuruluşundan (registrar) diğerine taşıma işlemidir. Daha iyi fiyat, Türkçe destek veya hosting entegrasyonu için KLEACORE'a transfer yapabilirsiniz. Bu rehberde transfer ön koşulları, adımlar ve sık karşılaşılan sorunları ele alıyoruz.

## Transfer Nedir ve Ne Değildir?

Transfer, domain sahipliğini değiştirmez; yalnızca hangi registrar'ın domaini yönettiğini değiştirir. WHOIS'teki registrant (sahip) bilgileri aynı kalabilir. Domain transferi, sitenizin çalışmasını kesintiye uğratmaz; DNS kayıtları doğru yapılandırıldığı sürece e-posta ve web erişimi devam eder.

**Not:** Alt domain transferi ayrı bir işlemdir; yalnızca kayıtlı üst domain transfer edilir.

## Transfer Ön Koşulları

- Domain en az **60 gün önce** kayıt veya son transfer edilmiş olmalıdır (ICANN kuralı)
- Domain **süresi dolmamış** olmalı; transfer sırasında genellikle 1 yıl uzatılır
- **Transfer kilidi** (registrar lock) kapalı olmalıdır
- **WHOIS e-postası** erişilebilir olmalı (onay maili için)
- **EPP / Auth code** mevcut registrar'dan alınmalıdır

.uk, .tr gibi bazı ülke uzantılarında ek yerel kurallar geçerlidir; .com.tr transferleri TRABİS prosedürüne tabidir.

## Adım Adım Transfer Süreci

1. Mevcut registrar panelinde transfer kilidini kaldırın
2. EPP (authorization) kodunu talep edin
3. KLEACORE domain transfer sayfasında alan adını ve auth kodunu girin
4. Ödemeyi tamamlayın (transfer genelde 1 yıl uzatma ücreti içerir)
5. WHOIS'teki admin e-postaya gelen onay linkine tıklayın (bazı TLD'lerde)
6. Transfer 5–7 gün içinde otomatik tamamlanır (hızlandırma mümkün olabilir)

Transfer süresince domain çalışmaya devam eder; yalnızca WHOIS güncellemeleri kısa süre kısıtlanabilir.

## DNS ve Kesinti Riskini Azaltma

Transfer öncesi DNS kayıtlarınızı not alın. Nameserver'ları değiştirmek zorunda değilsiniz; mevcut NS'leri koruyarak yalnızca registrar değişikliği yapabilirsiniz. KLEACORE hosting kullanıyorsanız NS'leri KLEACORE'a yönlendirmek yönetimi kolaylaştırır.

TTL değerini transfer öncesi 300 saniyeye düşürmek, olası DNS değişikliklerinde propagasyonu hızlandırır.

## Transfer Ücreti ve Uzatma

Çoğu TLD'de transfer, bir yıllık yenileme ücreti ile birlikte gelir. Mevcut kalan süreye ek olarak genellikle 1 yıl eklenir (maksimum toplam süre TLD'ye göre sınırlıdır, örn. 10 yıl). Kampanyalı transfer fiyatlarını KLEACORE fiyat listesinden kontrol edin.

## Reddedilen Transferler

Yaygın red nedenleri: yanlış auth kodu, açık transfer kilidi, domain dispute altında, son 60 gün içinde kayıt/transfer, ödenmemiş fatura. Red durumunda mevcut registrar'dan red sebebini öğrenin ve düzeltin.

## .com.tr ve Yerel Uzantılar

.tr ve .com.tr transferleri NIC.tr / TRABİS kurallarına tabidir. Belge doğrulama ve yerel temsilci gereksinimleri olabilir. KLEACORE destek ekibi Türk uzantıları için özel süreçte rehberlik sağlar.

## Transfer Sonrası Kontrol Listesi

- WHOIS bilgilerinin doğruluğu
- Otomatik yenileme ayarı
- DNS ve e-posta kayıtlarının çalıştığı
- SSL sertifikasının geçerliliği
- Domain privacy (gizlilik) durumu

## Transfer Sırasında E-posta ve Alt Hizmetler

Alan adına bağlı Google Workspace, Microsoft 365 veya özel nameserver yapılandırmaları transferden etkilenmez; ancak registrar değişikliği sonrası panel erişimi KLEACORE üzerinden olacaktır. Alt hizmet faturalarını (privacy, DNS premium) eski registrar'da kapatmayı unutmayın; çift faturalama önlenir.

## Toplu Transfer ve Portföy Yönetimi

Birden fazla domaininiz varsa transferleri aşamalı planlayın; tüm auth kodlarını ve bitiş tarihlerini bir tabloda takip edin. Kurumsal portföylerde otomatik yenileme ve birleşik fatura, operasyonel yükü azaltır. Transfer kampanyalarından yararlanırken uzun vadeli yenileme fiyatlarını da karşılaştırın.

## Sonuç

Domain transferi planlı yapıldığında güvenli ve kesintisizdir. Auth kodu ve kilidi kaldırma adımlarını tamamlayarak KLEACORE'a transfer başlatabilir; birleşik panelden domain, hosting ve SSL yönetiminin keyfini çıkarabilirsiniz.`,
  },
  {
    slug: "web-sitesi-yedekleme-rehberi",
    title: "Web Sitesi Yedekleme Rehberi: Verilerinizi Güvence Altına Alın",
    excerpt:
      "Tam yedek, artımlı yedek, 3-2-1 kuralı, otomatik yedekleme ve felaket kurtarma planı oluşturma.",
    categorySlug: "hosting",
    kbCategorySlug: "hosting",
    tags: ["yedekleme", "backup", "felaket kurtarma", "güvenlik"],
    metaTitle: "Web Sitesi Yedekleme Rehberi | Backup Stratejisi — KLEACORE",
    metaDescription:
      "Web sitesi yedekleme nasıl yapılır? 3-2-1 kuralı, otomatik backup, geri yükleme ve felaket kurtarma için kapsamlı rehber.",
    displayOrder: 10,
    content: `Web sitesi yedekleme, siber saldırı, insan hatası, donanım arızası veya güncelleme sorunlarına karşı iş sürekliliğinizi korur. Yedek olmadan saatlerce süren çalışmanız tek bir olayda kaybolabilir. Bu rehberde etkili yedekleme stratejisi, araçlar ve KLEACORE yedekleme seçeneklerini anlatıyoruz.

## Neden Yedekleme Zorunludur?

- **Ransomware** — Dosyalar şifrelenir; yedek tek kurtarma yolu
- **Yanlış güncelleme** — Eklenti veya çekirdek güncellemesi siteyi bozabilir
- **Silme hataları** — Veritabanı veya dosya yanlışlıkla silinebilir
- **Sunucu arızası** — Donanım ve disk hataları nadiren de olsa olur
- **Uyumluluk** — Bazı sektörler yasal yedekleme saklama süresi zorunlu kılar

"Yedek almayı planlıyorum" ile "dün yedek almadım" arasındaki fark, felaket anında anlaşılır.

## 3-2-1 Yedekleme Kuralı

Endüstri standardı **3-2-1 kuralı:**

- **3** kopya veri (üretim + 2 yedek)
- **2** farklı ortam/medya (ör. disk + bulut)
- **1** kopya off-site (farklı fiziksel lokasyon)

Yalnızca aynı sunucudaki yedek, sunucu çöktüğünde işe yaramaz. Off-site yedek zorunludur.

## Yedekleme Türleri

**Tam (full) yedek** — Tüm dosya ve veritabanı; geri yükleme basit, depolama maliyeti yüksek.

**Artımlı (incremental)** — Son yedekten sonraki değişiklikler; hızlı ve az yer kaplar; geri yükleme zincir gerektirir.

**Fark (differential)** — Son tam yedekten sonraki tüm değişiklikler; orta yol.

Üretim sitelerde günlük artımlı + haftalık tam yedek yaygın bir kombinasyondur.

## Neyi Yedeklemelisiniz?

- Web dosyaları (\`public_html\`, temalar, yüklemeler)
- Veritabanı dökümü (mysqldump, pg_dump)
- E-posta posta kutuları (ayrı politika gerekebilir)
- Yapılandırma dosyaları (\`.env\`, \`wp-config.php\` — güvenli saklayın)
- DNS zone export (registrar panelinden)

Statik site ile dinamik CMS farklı sıklıkta yedek gerektirir; e-ticaret sitelerinde sık yedek (günlük veya saatlik) tercih edilir.

## Otomatik Yedekleme

KLEACORE hosting paketlerinde otomatik yedekleme (günlük/haftalık) panelden yönetilebilir. Yedekleme zamanını düşük trafik saatlerine ayarlayın. Yedeklerin gerçekten restorable olduğunu **ayda bir test geri yükleme** ile doğrulayın; çalışmayan yedek, yedek değildir.

## Manuel ve Eklenti Tabanlı Yedek

WordPress: UpdraftPlus, BlogVault, Duplicator. Sunucu: cPanel Backup, rsync, tar + SCP. Veritabanı: cron ile otomatik dump ve uzak sunucuya gönderim. Manuel yedekleri şifreli ve erişim kontrollü saklayın.

## Saklama Süresi ve Rotasyon

Günlük yedekleri 7–30 gün, haftalıkları 3–6 ay, aylıkları 1 yıl saklamak yaygın bir politikadır. Depolama maliyeti ile kurtarma ihtiyacı dengesini kurun. GDPR/KVKK kapsamında kişisel veri içeren yedeklerin güvenliği sizin sorumluluğunuzdadır.

## Felaket Kurtarma (DR) Planı

DR planı şunları içermelidir:

1. RTO (Recovery Time Objective) — Ne kadar sürede ayağa kalkmalı?
2. RPO (Recovery Point Objective) — Ne kadar veri kaybı kabul edilebilir?
3. Sorumlu kişiler ve iletişim listesi
4. Adım adım geri yükleme prosedürü
5. Alternatif hosting veya sunucu

Planı yılda en az bir kez tatbikat ile test edin.

## Bulut ve Anlık Görüntü (Snapshot)

VPS/VDS'te snapshot, disk durumunun anlık kopyasıdır. Büyük güncelleme öncesi snapshot alın. Bulut object storage (S3 uyumlu) uzun süreli arşiv için ekonomiktir.

## Yedekleme Otomasyonu ve Uyarılar

Yedekleme işinin başarısız olduğu durumlar sessiz felakete yol açar. Cron job veya panel bildirimleri ile yedekleme başarısızlığında e-posta/SMS uyarısı alın. Yedek dosya boyutundaki ani düşüş veya artış da anomali işareti olabilir; izleme dashboard'u kurun. KLEACORE panelinden yedekleme geçmişini düzenli kontrol etmek iyi bir operasyonel alışkanlıktır.

## Sonuç

Yedekleme sigortadır; umarım kullanmazsınız ama ihtiyaç anında paha biçilmezdir. KLEACORE otomatik yedekleme, snapshot ve off-site seçenekleri ile sitenizi koruyabilir; yedekleme politikanızı bugün tanımlamak için destek ekibimizle iletişime geçin.`,
  },
];