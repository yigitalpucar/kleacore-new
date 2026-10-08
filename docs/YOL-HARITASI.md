# KLEACORE Yol Haritası — WISECP 5.0 Özellik Eşitliği

> Tarih: 08.10.2026 · Dal: `core/base` (son commit `a71fec2`)
> Kapsam: KLEACORE yalnızca sahibinin kendi altyapısı için (yeniden satılmayacak). Ajans + hosting bayisi:
> cPanel/WHM bayi sunucusu, Proxmox (VDS/VPS), Cloudflare DNS, Gri registrar, Paraşüt e-fatura, TRY + KDV,
> iyzico/PayTR (Stripe TR şirketlerine kapalı).
> Kaynak: WISECP 5.0 beta yalnızca özellik envanteri için incelendi (modül listeleri, admin ekranları, cron görev
> adları, tablo listesi, bildirim şablonu adları). Hiçbir kod/metin alınmadı; özellikler kendi cümlelerimizle anlatıldı.
> `docs/KLEACORE-WISECP-MASTER-PLAN.md` (Haziran 2026) kısmen eskidir; aşağıdaki durumlar koddan doğrulandı.

Durum etiketleri: **Var** (çalışan kod + çağrı yeri var) · **Kısmen** (çalışıyor ama eksik/tek senaryo) ·
**Taslak** (arayüz/stub var, gerçek iş yapmıyor) · **Yok**.
Önem: **Kritik** (gerçek para almadan önce şart) · **Yüksek** · **Orta** · **Düşük** · **Gereksiz** (bizim iş modelinde yeri yok).

---

## 1. Özet

1. KLEACORE'un **iskeleti WISECP'nin çekirdek akışını karşılıyor**: sepet → fatura → iyzico/PayTR/havale → fulfillment → cPanel/Virtualizor/Gri provisioning → yenileme faturası → gecikme → askıya alma (`src/lib/payments/*`, `src/lib/cron/jobs/*`).
2. WISECP'nin gücü **modül genişliği** (234 ödeme, 89 registrar, 47 sunucu, 36 SMS, 15 mail modülü) ve **kuyruk tabanlı otomasyon** (≈60 keşif/çalıştırma cron görevi). Bizim için bu genişliğin %95'i gereksiz; ihtiyacımız ~10 modül.
3. **En büyük açık domain yaşam döngüsü**: `renewDomain` Gri sağlayıcısında yazılmış ama hiçbir yerden çağrılmıyor; yenileme faturası cron'u yalnızca `Service` tablosunu tarıyor, `Domain` tablosunu değil → domainler sessizce düşer.
4. **Proxmox sağlayıcısı yok** (yalnızca Virtualizor + generic HTTP). Sahibin VDS/VPS altyapısı Proxmox → otomasyon şu an fiilen manuel.
5. **Cloudflare DNS entegrasyonu yok**; DNS kayıtları yalnızca registrar'a (Gri) senkronize ediliyor.
6. Para alanları `Float` (şemada 55 alan); kuruş yuvarlama hatası ve muhasebe uyumsuzluğu riski.
7. Ödeme ağ geçidi **tek aktif sağlayıcı** mantığında (`payment_gateway_provider`, varsayılan `stripe`); iyzico + PayTR + havale aynı anda sunulamıyor, ağ geçidi üzerinden iade yok.
8. Bildirimler 8 sabit kodlu e-posta fonksiyonu (`src/lib/notifications/email.ts`); şablon tablosu, kuyruk ve gönderim logu yok. SMS (NetGSM, İletiMerkezi) çalışıyor.
9. Olay sistemi 3 olay tipiyle sınırlı ve "ateşle-unut" (`src/lib/events/dispatcher.ts`, kalıcı kayıt yok); kalıcı iş kuyruğu yok (yalnızca provisioning retry tablosu).
10. Güvenlik/ödeme bütünlüğü/platform düzeltmeleri **paralel olarak devam ediyor**; bu yol haritası onların üstüne kurulur. Faz 1 (~22-28 gün) sonrası gerçek ücretli müşteri güvenle alınabilir.

---

## 2. Özellik envanteri

### 2.0 Paralel olarak devam eden işler (bu yol haritasında "yapılacak" sayılmaz)

| Alan | İş | Durum |
|---|---|---|
| Güvenlik | 2FA bypass düzeltmesi, rate limit, oturum yenileme | devam ediyor |
| Ödeme bütünlüğü | Çift fulfillment önleme, ardışık fatura numarası (bugün `generateInvoiceNumber` rastgele 4 hane — `src/lib/utils/number-generators.ts`), ödemede askıdan çıkarma, grace period | devam ediyor |
| Platform | Next/next-auth yükseltmesi (bugün `next 16.1.1`, `next-auth 5.0.0-beta.30`), container göçü, health check, cron düzeltmesi, güvenlik başlıkları | devam ediyor |

### 2.1 Sipariş / sepet

| Özellik | WISECP | KLEACORE durumu | Önem | Not |
|---|---|---|---|---|
| Çok kalemli sepet | Var | **Var** — `src/lib/actions/customer/checkout.ts` (`checkoutCart`, `items[]`), `src/store/cart-store.ts` | Kritik | |
| Faturalama dönemleri | Var (esnek) | **Var** — `BillingPeriod` enum (aylık…3 yıllık), `src/lib/billing/period-price.ts` | Kritik | Yıllık=12 ay düzeltmesi `dce11cf` |
| Yapılandırılabilir seçenekler / eklentiler | Var (addons, requirements) | **Var** — `ProductConfigOption`, `ProductAddon` modelleri, `admin/product-config-options.ts` | Yüksek | Sipariş sırasında müşteriden bilgi isteme (requirements) yok |
| Promosyon / kupon | Var | **Var** — `PromotionCode`, `admin/promotions.ts` | Orta | |
| Stok takibi | Var | **Kısmen** — `Product.stockQuantity`; Proxmox kapasitesiyle bağlı değil | Orta | VDS stoku gerçek kaynaklardan gelmeli |
| Sipariş onay akışı (manuel/otomatik) | Var | **Kısmen** — `OrderStatus` PENDING/APPROVED; `admin/orders.ts` | Yüksek | Ürün bazında "ödeme sonrası otomatik kur / admin onayı bekle" ayarı yok |
| Sipariş süresi dolunca temizleme | Var (OrderExpire/Purge) | **Yok** | Orta | Ödenmemiş PENDING siparişler birikir |
| Domain + hosting birlikte sipariş | Var | **Kısmen** — `Order.domain`, `provisioning/internal.ts` domain kaydı yapıyor | Kritik | Domain ayrı ürün olarak sepete eklenebiliyor; ilişki zayıf |
| Yükseltme / düşürme (prorata) | Var | **Var** — `src/lib/services/plan-change.ts` (625 satır, testli) | Yüksek | |
| İptal talebi | Var | **Var** — `CancellationRequest`, `customer/cancellation.ts` | Yüksek | Dönem sonunda otomatik iptal cron'u yok |
| Teklif (quote) / proforma | Var | **Yok** | Düşük | Ajans işleri için faydalı olabilir (Faz 4) |

### 2.2 Faturalandırma & tahsilat

| Özellik | WISECP | KLEACORE durumu | Önem | Not |
|---|---|---|---|---|
| Fatura oluşturma (otomatik + manuel) | Var | **Var** — `admin/invoices.ts`, `/yonetim/faturalar/olustur` | Kritik | |
| Yenileme faturası (X gün önce) | Var | **Kısmen** — `cron/jobs/generate-renewal-invoices.ts` (sabit 7 gün, yalnız `Service`) | Kritik | Domain yok; gün ayarı yok |
| KDV hesabı | Var (bölge bazlı vergi) | **Var** — `src/lib/billing/tax.ts`, `getTaxRate()` | Kritik | Tek oran; KDV muafiyeti/yurtdışı müşteri yok (Düşük) |
| Para alanları kesinliği | DB decimal | **Risk** — 55 `Float` alanı (`prisma/schema.prisma`) | Kritik | `Decimal`e göç Faz 1 |
| Ardışık fatura no | Var | devam ediyor | Kritik | |
| Fatura PDF | Var | **Var** — `src/app/api/faturalar/[id]/pdf/route.ts` | Yüksek | Resmi belge Paraşüt e-arşiv olmalı |
| e-Fatura / e-Arşiv | Addon (Paraşüt) | **Kısmen** — `integrations/efatura/providers/parasut*.ts`, ödemede `queueEInvoiceDraft` (`payments/fulfillment.ts:244`) | Kritik | Uçtan uca canlı doğrulama + e-fatura mükellefi sorgusu (`efatura/customer-status.ts`) test edilmeli |
| Kredi kartı (3D) | Var | **Var** — iyzico, PayTR sağlayıcıları + callback'ler (`api/payments/*/callback`) | Kritik | |
| Çoklu ağ geçidi aynı anda | Var | **Yok** — `payment-gateways/index.ts` tek `payment_gateway_provider`, varsayılan `stripe` | Kritik | |
| Havale/EFT + admin onayı | Var | **Var** — `payments/methods.ts`, `admin/invoices.ts:178` | Kritik | Banka hesap bilgisi ayarı/dekont yükleme yok |
| Bakiye (kredi) | Var | **Var** — `User.balance`, `payments/balance-top-up.ts`, `/musteri/panel/kredi` | Orta | Float bakiye |
| İade (refund) | Var (fatura iade durumu) | **Kısmen** — `Order.refundAmount` alanı; ağ geçidi iade API'si yok | Yüksek | iyzico/PayTR iade çağrısı + kredi notu |
| Kayıtlı kart / otomatik tahsilat | Var (stored cards, auto-payment) | **Yok** | Orta | iyzico kart saklama / PayTR recurring (Faz 3) |
| Gecikme faizi (late fee) | Var | **Yok** | Düşük | |
| Fatura hatırlatma (çok aşamalı) | Var | **Kısmen** — manuel hatırlatma `admin/invoices.ts:269-280`; otomatik yalnız gecikme SMS'i | Yüksek | Vade öncesi 3/1 gün + sonrası 1/3/7 gün akışı |
| Gider / kasa / periyodik gider | Var | **Yok** | Düşük | Muhasebe Paraşüt'te |
| Abonelik (ağ geçidi abonelikleri) | Var | **Yok** | Düşük | |

### 2.3 Hizmet yaşam döngüsü

| Özellik | WISECP | KLEACORE durumu | Önem | Not |
|---|---|---|---|---|
| Ödeme → otomatik kurulum | Var | **Var** — `payments/fulfillment.ts`, `provisioning/internal.ts` | Kritik | |
| Kurulum hatasında tekrar deneme | Var (modül kuyruğu) | **Var** — `provisioning/retry-queue.ts`, `/api/cron/retry-provisioning` (15 dk) | Kritik | Sadece provisioning; genel kuyruk değil |
| Manuel provisioning (modülsüz ürün) | Var | **Kısmen** — `/yonetim/provisioning`, `admin/provisioning.ts` | Kritik | Admin'e görev + bildirim düşmeli |
| Askıya alma (gecikme) | Var | **Kısmen** — `cron/jobs/suspend-overdue-services.ts` | Kritik | Hizmete bağlı olmayan gecikmiş fatura → müşterinin **tüm** aktif hizmetleri askıya alınıyor; grace period paralel işte |
| Askıdan çıkarma (ödeme) | Var | devam ediyor | Kritik | |
| Fesih (terminate) X gün sonra | Var | **Yok** (yalnız manuel `admin/services.ts:239`) | Yüksek | Otomatik fesih cron'u + onay listesi |
| Hizmet sunucu ataması (çoklu sunucu / grup) | Var (server groups) | **Yok** — `Service.serverName` serbest metin, `Server` modeline FK yok; cPanel tek sunucu config (`provisioning/config.ts`) | Yüksek | |
| Güç işlemleri (start/stop/restart) | Var | **Var** — `services/server-power.ts`, Virtualizor; ödeme kaynaklı askıda engelli (`a71fec2`) | Yüksek | Proxmox ile yeniden yazılmalı |
| Kaynak kullanımı / metrik | Var (metrik faturalama) | **Taslak** — `Service.diskUsed/cpuUsage` alanları, besleyen sync yok | Orta | WHM/Proxmox'tan günlük sync |
| Hizmet devri (müşteriden müşteriye) | Var | **Yok** | Gereksiz | |

### 2.4 Domain

| Özellik | WISECP | KLEACORE durumu | Önem | Not |
|---|---|---|---|---|
| Uygunluk sorgu / WHOIS | Var | **Var** — `actions/public/domains.ts`, Gri `checkDomainAvailability`, RDAP (`6773a78`) | Kritik | |
| Kayıt | Var | **Var** — `provisioning/internal.ts:89` → `registerDomainWithRegistrar` | Kritik | |
| Transfer (EPP) | Var | **Var** — `actions/customer/domain-transfer.ts:271` | Yüksek | Transfer durum takibi cron'u yok |
| **Yenileme (registrar'da)** | Var | **Yok** — `renewDomain` (`registrar/providers/gri.ts:182`) hiç çağrılmıyor; yenileme cron'u `Domain` taramıyor | **Kritik** | Faz 1 #1 |
| Süre sonu bildirimleri (yaklaşan, doldu, grace, redemption, silinme) | Var (5 aşama) | **Yok** | Kritik | |
| Registrar ile durum senkronu (expiry, status) | Var | **Yok** | Yüksek | Günlük Gri sync |
| NS güncelleme | Var | **Var** — `actions/customer/domains.ts:268` | Kritik | |
| DNS yönetimi | Var (registrar DNS) | **Kısmen** — kayıtlar Gri'ye yazılıyor (`domains.ts:95`); Cloudflare yok | Yüksek | Bizim DNS Cloudflare'de |
| TLD fiyat senkronu | Var (+kur dönüşümü) | **Kısmen** — `syncRegistrarTldPricing` + `DomainTld`; kâr marjı/kur yok | Yüksek | Gri USD fiyat → TRY |
| .tr belge süreci (TRABİS) | Var (domain docs) | **Kısmen** — `/domain/belgesiz-tr` sayfası; belge talep/yükleme akışı yok | Orta | |
| WHOIS gizliliği, kilit, EPP kodu gösterme | Var | **Kısmen** — `Domain.privacyEnabled` alanı | Orta | |
| WHOIS kişi profilleri | Var | **Yok** | Düşük | |

### 2.5 Sunucu / hosting otomasyonu

| Özellik | WISECP | KLEACORE durumu | Önem | Not |
|---|---|---|---|---|
| cPanel/WHM hesap aç/askıya al/aç/sil/paket değiştir | Var | **Var** — `provisioning/providers/cpanel-whm*.ts` | Kritik | |
| cPanel e-posta hesapları | Var | **Var** — `integrations/email-provisioning/index.ts` | Yüksek | |
| cPanel tek tıkla giriş (SSO) | Var | **Yok** | Yüksek | WHM `create_user_session` |
| Proxmox VE (VM oluştur, şablondan klon, güç, VNC, reinstall) | Var | **Yok** | **Kritik** (VDS satılıyorsa) | Şablon 9000 mevcut altyapıda |
| Virtualizor | Var | **Var** — `virtualizor*.ts` | Gereksiz | Bizde Virtualizor yok; bakıma alınmamalı |
| Generic HTTP sağlayıcı | — | **Var** — `provisioning/providers/http.ts` | Düşük | |
| Sunucu envanteri / sağlık | Var | **Kısmen** — `Server` modeli, `/yonetim/sunucular`; metrikler elle | Orta | |
| IP havuzu (IPAM) | Var (addon) | **Yok** | Orta | Proxmox VDS'lere IP atama için gerekli |
| DirectAdmin, Plesk, Hetzner, Pterodactyl … | Var | **Yok** | Gereksiz/Düşük | Bkz. §3 |

### 2.6 SSL

| Özellik | WISECP | KLEACORE durumu | Önem | Not |
|---|---|---|---|---|
| SSL satışı (Sectigo vb. bayilik) | 19 sağlayıcı | **Taslak** — `ssl/providers/sectigo.ts` "api-stub" döner | Düşük | |
| Let's Encrypt | — | **Taslak** — `ssl/providers/letsencrypt.ts` sahte challenge token | Gereksiz | cPanel AutoSSL zaten yapıyor; stub kaldırılmalı |
| SSL süre bildirimi | Var | **Var** — `cron/jobs/check-ssl-expiry.ts` | Düşük | Yalnız KLEACORE'da kayıtlı SSL'ler |

### 2.7 Müşteri paneli

| Özellik | WISECP | KLEACORE durumu | Önem | Not |
|---|---|---|---|---|
| Hizmetler, faturalar, domainler, destek | Var | **Var** — `src/app/musteri/panel/*` | Kritik | |
| Profil, 2FA, API anahtarı | Var | **Var** — `customer/profile.ts`, `two-factor.ts`, `api-keys.ts` | Yüksek | |
| Yedekler (müşteri) | Var | **Var** — `/musteri/panel/yedekleme`, `customer/backups.ts` | Orta | |
| Webmail | — | **Taslak** — `/musteri/panel/webmail` hesap listesi (`dal/webmail.ts`); gerçek webmail cPanel'de | Düşük | Roundcube linki yeterli |
| E-posta doğrulama zorunluluğu | Var | **Kısmen** — `User.emailVerifiedAt` alanı | Yüksek | Kayıtta doğrulama maili + zorunluluk |
| Telefon (GSM) doğrulama | Var | **Yok** | Orta | NetGSM OTP ile kolay |
| Alt kullanıcılar (yetkili kişi) | Var | **Yok** | Düşük | Kurumsal müşteride muhasebeci erişimi |
| KVKK veri talebi (GDPR) | Var | **Yok** | Orta | Basit form + admin onayı yeter |
| Bayilik / satış ortaklığı | Var | **Var** — `/musteri/panel/bayilik`, `/satis-ortakligi`, `lib/reseller`, `lib/affiliate` | Gereksiz | Yeniden satış yok; gizlenebilir |

### 2.8 Yönetim / personel & yetkiler

| Özellik | WISECP | KLEACORE durumu | Önem | Not |
|---|---|---|---|---|
| Admin paneli (müşteri/sipariş/hizmet/fatura) | Var | **Var** — `src/app/yonetim/*` | Kritik | |
| Personel rolleri / ayrıntılı yetki | Var (privileges) | **Yok** — `UserRole` yalnız `ADMIN`/`CUSTOMER` | Orta | Tek kişi + 1-2 personel; destek-only rol yeter |
| Aktivite / denetim logu | Var | **Var** — `ActivityLog`, `/yonetim/aktivite` | Yüksek | Admin giriş logu, IP, başarısız giriş ayrı tutulmalı |
| Admin görevleri / hatırlatıcılar | Var | **Yok** | Düşük | |
| Toplu bildirim (duyuru e-posta/SMS) | Var | **Yok** | Orta | Bakım duyurusu için |
| Modül/kuyruk/mail/SMS logları ekranı | Var | **Kısmen** — `/yonetim/entegrasyonlar`, `module-status.ts`, `api/admin/integrations/health` | Yüksek | Gönderim logu yok |
| Durum sayfası + olaylar | — | **Var** — `/yonetim/durum`, `SystemIncident` | Orta | WISECP'de yok, bizde artı |
| Site içerik yönetimi (blog, KB, sayfa) | Var | **Var** — `/yonetim/icerik/*` | Düşük | |

### 2.9 Destek

| Özellik | WISECP | KLEACORE durumu | Önem | Not |
|---|---|---|---|---|
| Ticket aç/yanıtla/kapat | Var | **Var** — `SupportTicket`, `customer/tickets.ts`, `admin/tickets.ts` | Kritik | |
| Departmanlar | Var (DB, çok dilli) | **Kısmen** — sabit enum `TicketDepartment` (4 adet) | Düşük | Yeterli |
| Ek dosya | Var | **Kısmen** — `TicketMessage.attachments` Json; depolama/virüs kontrolü belirsiz | Yüksek | Boyut/tip sınırı + özel depolama |
| E-posta ile ticket (pipe/IMAP/Google/Microsoft) | Var | **Yok** | Yüksek | destek@ adresine gelen mail → ticket |
| Hazır yanıtlar | Var | **Yok** | Orta | |
| Otomatik kapatma (X gün yanıtsız) | Var | **Yok** | Orta | |
| Atama / iç not / özel alanlar | Var | **Kısmen** — `assignedTo` alanı | Düşük | |
| Admin'e yeni ticket bildirimi | Var | **Kısmen** — `loadSupportNotificationEmail` (`notifications/email.ts:497`) | Yüksek | SMS/Telegram ile acil |

### 2.10 Bildirimler

| Özellik | WISECP | KLEACORE durumu | Önem | Not |
|---|---|---|---|---|
| E-posta gönderimi | Var (15 sağlayıcı) | **Var** — SMTP/nodemailer `src/lib/mail.ts` | Kritik | |
| Şablon sayısı | ~90 (sipariş, fatura, hizmet, domain, kullanıcı, ticket) | **8** sabit fonksiyon (`notifications/email.ts`) | Yüksek | Hoş geldin, şifre değişti, hizmet aktif (giriş bilgileri), domain kayıt/yenileme, iptal eksik |
| Admin'den düzenlenebilir şablon | Var | **Yok** | Orta | |
| Bildirim kuyruğu + tekrar deneme | Var | **Yok** — `dispatchNotification` fire-and-forget | Yüksek | |
| Gönderim logu (mail/SMS) | Var | **Yok** | Yüksek | "Müşteriye mail gitti mi?" sorusu cevapsız |
| SMS | Var (36) | **Var** — NetGSM, İletiMerkezi (`integrations/sms/providers/*`) | Yüksek | |
| Panel içi bildirim | Var | **Var** — `Notification` modeli | Orta | |

### 2.11 Raporlama

| Özellik | WISECP | KLEACORE durumu | Önem | Not |
|---|---|---|---|---|
| Gelir / tahsilat raporu | Var | **Var** — `lib/reports/accounting.ts`, `/yonetim/raporlar`, CSV export | Yüksek | |
| KDV tahakkuk raporu | Var | **Kısmen** — `accounting.ts` | Yüksek | Paraşüt ile mutabakat |
| Ağ geçidine göre, iade, iptal, ülke, ürün dağılımı | Var | **Kısmen** — `dal/dashboard.ts`, `dal/reports.ts` | Düşük | |
| MRR / churn | Var (kısmen) | **Yok** | Orta | |
| Gerçek zamanlı ziyaretçi | Var | **Yok** | Gereksiz | |

### 2.12 Güvenlik

| Özellik | WISECP | KLEACORE durumu | Önem | Not |
|---|---|---|---|---|
| 2FA (TOTP) | Var (+SMS/e-posta, passkey) | **Var** — `src/lib/auth/two-factor.ts` (otpauth) | Kritik | bypass düzeltmesi devam ediyor |
| Rate limit | Var | **Var** — `RateLimitBucket`, `src/lib/rate-limit.ts` | Kritik | devam ediyor |
| Captcha | Var (Turnstile, hCaptcha, reCaptcha) | **Yok** | Yüksek | Turnstile — Cloudflare zaten kullanılıyor |
| Fraud kontrolü | Var (MaxMind, FraudLabs) | **Yok** | Orta | Basit kural seti yeter (IP ülke, kart ülkesi, ilk sipariş VDS → manuel onay) |
| KYC / belge doğrulama | Var | **Yok** | Orta | VDS'de kötüye kullanım riski; kimlik/vergi levhası yükleme |
| Güvenilir cihaz / passkey | Var | **Yok** | Düşük | |
| Sırların şifrelenmesi | — | **Var** — `src/lib/secrets/crypto.ts`, `setting-keys.ts` | Kritik | |
| Başarısız giriş bildirimi | Var | **Yok** | Orta | |

### 2.13 Entegrasyonlar

| Tür | WISECP | KLEACORE | Önem | Not |
|---|---|---|---|---|
| Ödeme | 234 modül | iyzico, PayTR, Stripe (kullanılamaz), havale | Kritik | Bkz. §3 |
| Registrar | 89 | Gri, generic HTTP | Kritik | |
| Sunucu | 47 | cPanel/WHM, Virtualizor, generic HTTP | Kritik | Proxmox eksik |
| SMS | 36 | NetGSM, İletiMerkezi | Yüksek | |
| Mail | 15 | SMTP | Yüksek | Resend/SES opsiyonel |
| Depolama (yedek hedefi) | 7 (SFTP, Drive, Bunny…) | **Yok** — `scripts/backup-postgres.sh` yerel | Kritik | Off-site DB yedeği şart |
| Kur | 7 | **Yok** | Orta | TCMB yeterli |
| e-Fatura | Paraşüt addon | Paraşüt | Kritik | |
| DNS (Cloudflare) | addon (kendi DNS) | **Yok** | Yüksek | |
| Giden webhook | — | **Var** — `integrations/webhooks/outbound.ts` | Düşük | |
| Sosyal giriş | Google/Apple/MS | **Yok** | Gereksiz | |

### 2.14 İçe aktarma

| Özellik | WISECP | KLEACORE | Önem | Not |
|---|---|---|---|---|
| WHMCS / Blesta / WISECP içe aktarma | Var | **Yok** | **Gereksiz** | Eski WHMCS 06.10'da kaldırıldı, yedeği de silindi; içe alınacak veri yok |
| WHM hesaplarını içe alma (mevcut müşteriler) | — | **Yok** | **Yüksek** | Bayi sunucudaki mevcut hesapları `Service` olarak eşleme (listaccts → müşteri/ürün/vade) |
| Proxmox VM'leri içe alma | — | **Yok** | Yüksek | Mevcut VDS müşterileri |
| Gri domainlerini içe alma | — | **Yok** | Yüksek | Gri hesap listesinden `Domain` kayıtları |

### 2.15 Çoklu dil / kur

| Özellik | WISECP | KLEACORE | Önem | Not |
|---|---|---|---|---|
| Çoklu dil (TR/EN/DE/FR) | Var | **Yok** (yalnız TR) | Düşük | Yabancı müşteri hedefi yoksa gereksiz |
| Çoklu para birimi | Var | **Yok** — `Invoice`'ta para birimi alanı yok | Düşük | Satış TRY; yalnız maliyet tarafında USD |
| Otomatik kur güncelleme | Var | **Yok** | Orta | Gri USD maliyet → TRY satış fiyatı |

### 2.16 API

| Özellik | WISECP | KLEACORE | Önem | Not |
|---|---|---|---|---|
| REST API (müşteri) | Var | **Var** — `/api/v1/{domains,invoices,orders,services,tickets}`, OpenAPI `/api/v1/openapi`, `/api-docs` | Düşük | |
| Admin API + kapsam (scope) | Var | **Yok** — anahtar müşteri bağlamlı (`lib/api/v1/auth.ts`) | Düşük | Otomasyon/AI ajanı için ileride |
| Idempotency, kötüye kullanım koruması | Var | **Kısmen** — `lib/api/v1/rate-limit.ts` | Düşük | |

### 2.17 Otomasyon / cron

| Özellik | WISECP | KLEACORE | Önem | Not |
|---|---|---|---|---|
| Zamanlayıcı | Tek cron girişi + iç kuyruk (keşfet → kuyruğa at → çalıştır) | 6 HTTP uç noktası, Dokploy zamanlanmış görevleri (`scripts/setup-dokploy-schedules.mjs`); `vercel.json` eski | Kritik | |
| Kilit (aynı anda iki çalışma) | Var | **Yok** | Kritik | cron düzeltmesi paralelde; kilit ayrıca Faz 1'de |
| Çalışma geçmişi / sonuç ekranı | Var | **Yok** — `runCronJob` yalnız `console.error` (`lib/cron/handler.ts`) | Yüksek | |
| İş bazlı tekrar deneme | Var | **Kısmen** — yalnız provisioning | Yüksek | |
| Domain, fesih, sipariş temizliği, ticket kapatma, kur, metrik görevleri | Var | **Yok** | bkz. ilgili satırlar | |

### 2.18 Yedekleme

| Özellik | WISECP | KLEACORE | Önem | Not |
|---|---|---|---|---|
| Uygulama/DB yedeği + uzak depolama | Var | **Kısmen** — `scripts/backup-postgres.sh` (yerel) | Kritik | Şifreli off-site (SFTP/B2/Drive) + geri yükleme provası |
| Müşteri hizmet yedeği (cPanel) | — | **Var** — `integrations/backups/providers/cpanel-backup.ts`, `/api/cron/run-backups` | Orta | |
| Proxmox VM yedeği (vzdump/PBS) tetikleme | — | **Yok** | Orta | |

---

## 3. Modül önceliği (gerçek ihtiyaç)

WISECP kataloğundan bizim için anlamlı olanlar. Geri kalan her şey **gereksiz**.

### 3.1 Ödeme (234 modülden)

| Modül | Karar | Gerekçe |
|---|---|---|
| **PayTR** (KK, 3D, taksit) | Kritik — var | Ana sanal POS. Ek: iade API, kart saklama (Faz 3) |
| **iyzico** | Kritik — var | Yedek/alternatif; aynı anda açık olabilmeli |
| **Havale/EFT** | Kritik — var | Kurumsal müşteriler; banka hesapları ayarı + dekont |
| **PayTR Havale/EFT (sanal hesap)** | Orta | Otomatik eşleşen havale; manuel onay yükünü kaldırır |
| Banka sanal POS'ları (Garanti, Akbank, İş, YKB, Ziraat, Finans, Kuveyt) | Düşük | Ancak komisyon avantajı varsa tek bir banka; PayTR yeterli |
| Bakiye (dahili) | Var | |
| Stripe | Gereksiz | TR şirketine kapalı; kod kalabilir ama varsayılan `stripe` olmamalı |
| PayPal, Payssion_*, Tripay_*, kripto, diğer 220+ | Gereksiz | |

### 3.2 Registrar (89 modülden)

| Modül | Karar | Gerekçe |
|---|---|---|
| **Gri** | Kritik — var (yenileme eksik) | .tr + gTLD |
| Global ikinci registrar (OpenProvider / ResellerClub / Namecheap) | Düşük | Gri'de olmayan TLD veya fiyat avantajı çıkarsa; arayüz hazırsa 3-4 gün |
| Cloudflare Registrar | Gereksiz | Bayi API'si yok |
| Diğer 85+ (ülke NIC'leri, EPP) | Gereksiz | |

### 3.3 Sunucu (47 modülden)

| Modül | Karar | Gerekçe |
|---|---|---|
| **cPanel/WHM** | Kritik — var | Bayi sunucusu |
| **Proxmox VE** | Kritik — yok | VDS/VPS altyapısı |
| DirectAdmin | Gereksiz | Kullanılmıyor |
| Hetzner Cloud/Robot | Düşük | Yalnız kapasite taşması olursa |
| Pterodactyl | Düşük | FT TEAM Minecraft sunucusu var ama satış ürünü değil |
| Virtualizor | Gereksiz (var) | Kullanılmıyor; dondurulmalı |
| Plesk, aaPanel, CyberPanel, Enhance, Vultr, DO, Linode, OVH … | Gereksiz | |

### 3.4 SMS (36 modülden)

| Modül | Karar |
|---|---|
| **NetGSM** | Yüksek — var (birincil) |
| **İletiMerkezi** | Orta — var (yedek) |
| Verimor, MutluCell, Interaktif, OztekSMS | Gereksiz (biri yeter) |
| Twilio vb. global | Gereksiz |

### 3.5 Mail (15 modülden)

| Modül | Karar | Gerekçe |
|---|---|---|
| **SMTP** | Kritik — var | |
| **Resend** veya **Amazon SES** | Orta | Teslim edilebilirlik + bounce webhook; SMTP arkasında tek sağlayıcı yeter |
| Brevo, Mailgun, Postmark, SendGrid … | Gereksiz | |

### 3.6 Diğer kategoriler

| Kategori | Karar |
|---|---|
| Captcha | **Turnstile** (Yüksek); diğerleri gereksiz |
| Fraud | Kendi basit kural motoru (Orta); MaxMind/FraudLabs gereksiz |
| Kur | **TCMB günlük kur XML** (Orta); ücretli API'ler gereksiz |
| Depolama | **SFTP** veya S3 uyumlu (B2/R2) — Kritik (DB yedeği); Drive opsiyonel |
| Pipe | **IMAP** (Yüksek); Google/Microsoft OAuth pipe gereksiz |
| Addons: Paraşüt | Var |
| Addons: KYC, IPAM, DNS | Kendi küçük modüllerimiz (Orta) |
| Addons: AI asistan, çeviri, canlı sohbet, virüs tarayıcı, Lexware | Gereksiz |
| İçe aktarma (WHMCS/Blesta/WISECP) | Gereksiz |
| Sosyal giriş, IP konum servisleri | Gereksiz |

---

## 4. Mimari öneri

### 4.1 Bugünkü durum (`src/lib/integrations`)

- Her tür kendi klasöründe: `payment-gateways/`, `registrar/`, `provisioning/`, `sms/`, `ssl/`, `efatura/`, `backups/`, `email-provisioning/`, `webhooks/`.
- Desen: `config.ts` (Setting tablosundan anahtar okuma) + `index.ts` (if/else fabrika) + `providers/<ad>.ts` + `providers/disabled.ts`. Ortak sonuç tipi `IntegrationResult` (`integrations/settings.ts`). Bu temel iyi.
- Sorunlar:
  1. **Tür başına tek aktif sağlayıcı**: ödeme `payment_gateway_provider`, registrar `registrar_provider`, VPS `vps_vds_provider`. Aynı anda iki ödeme yöntemi veya iki cPanel sunucusu mümkün değil.
  2. **Sağlayıcı seçimi kategoriye gömülü**: `provisioning/index.ts` ürün kategorisinden (`isCpanelCategory`/`isVpsVdsCategory`) sağlayıcı çıkarıyor; ürün→modül→sunucu bağı yok.
  3. Ayar anahtarları dağınık (`secrets/setting-keys.ts`, her `config.ts`), şema/doğrulama yok; admin formu elle (`module-status.ts` 434 satır).
  4. Yetenek (capability) bilgisi yok: örn. `fetchTldPricing?` opsiyonel metot kontrolüyle anlaşılıyor.
  5. Yinelenen giriş noktaları: `integrations/registrar.ts` ve `integrations/provisioning-provider.ts` yeniden-ihracat (re-export) dosyaları.

### 4.2 Hedef: modül kaydı + örnek (instance)

```
src/lib/modules/
  registry.ts                 # tüm modüllerin manifest listesi
  types.ts                    # ModuleKind, ModuleManifest, Capability
  payment/{paytr,iyzico,bank-transfer}/index.ts
  registrar/{gri}/index.ts
  server/{cpanel-whm,proxmox}/index.ts
  dns/{cloudflare}/index.ts
  sms/{netgsm,iletimerkezi}/index.ts
  mail/{smtp,resend}/index.ts
  storage/{sftp,s3}/index.ts
  einvoice/{parasut}/index.ts
```

- **Manifest**: `{ id, kind, name, configSchema (zod), secretFields, capabilities[], healthCheck() }`. Admin formu `configSchema`'dan otomatik üretilir; `module-status.ts` sadeleşir.
- **`ModuleInstance` tablosu** (yeni): `id, kind, moduleId, label, config (şifreli JSON — mevcut `secrets/crypto.ts`), isActive, priority`. Örn. iki WHM sunucusu, iki Proxmox node'u, PayTR + iyzico aynı anda.
- **Ürün bağlantısı**: `Product.serverModuleInstanceId` / `Product.moduleOptions` (WHM paket adı, Proxmox şablon ID, CPU/RAM/disk); `Service.moduleInstanceId` + `Service.remoteId` (WHM kullanıcı adı / Proxmox VMID). `Service.serverName` serbest metni kaldırılır.
- **Sözleşmeler** (mevcut arayüzler genişletilir, kırılmaz):
  - `PaymentModule`: `createCheckout`, `verifyCallback`, `refund?`, `storeCard?`, `chargeStoredCard?`.
  - `RegistrarModule`: mevcut `RegistrarProvider` + `getDomainInfo` (expiry/status sync), `getEppCode?`, `setLock?`, `listDomains?` (içe aktarma).
  - `ServerModule`: mevcut `ProvisioningProvider` + `getUsage?`, `getSsoUrl?`, `getConsoleUrl?`, `reinstall?`, `listAccounts?` (içe aktarma).
  - `DnsModule`: `listRecords`, `upsertRecord`, `deleteRecord`, `ensureZone`.
  - `NotifierModule` (SMS/mail): `send(message) → { providerMessageId }`, `parseDeliveryWebhook?`.
- **Sözleşme testleri**: her modül için ortak vitest seti (sahte HTTP ile), mevcut `*.test.ts` deseni korunur.
- Virtualizor, Sectigo/Let's Encrypt stub'ları ve Stripe: `registry`'de `hidden: true` olarak dondurulur, ileride silinir.

### 4.3 Olay ve bildirim sistemi

Bugün: `events/types.ts` 3 olay, `dispatcher.ts` webhook + activity log, `dispatchEvents` `void` ile arka planda — süreç ölürse olay kaybolur.

Hedef (**transactional outbox**):
1. `DomainEvent` tablosu: `id, type, payload, occurredAt, processedAt, attempts`. Olay, iş işlemiyle **aynı DB transaction'ında** yazılır (örn. `fulfillment.ts` içinde).
2. Olay kataloğu (~30): `order.created/paid/cancelled`, `invoice.created/paid/overdue/cancelled/refunded`, `service.activated/suspended/unsuspended/terminated/renewed/plan_changed`, `domain.registered/renewed/transferred/expiring/expired/redemption`, `ticket.opened/replied/closed`, `user.registered/password_changed/login_failed`, `payment.failed`.
3. Abone (handler) listesi kodda: `notifications` (şablon seç → mail/SMS kuyruğu), `webhooks`, `activity-log`, `einvoice` (invoice.paid → Paraşüt), `admin-alert` (ticket.opened → admin SMS).
4. **Bildirim şablonları**: `NotificationTemplate (event, channel, locale, subject, body, isActive)`; değişkenler tipli (`{{customer.name}}`, `{{invoice.number}}`); varsayılanlar seed ile; admin düzenleme ekranı.
5. **Gönderim logu**: `NotificationLog (channel, to, templateKey, status, providerMessageId, error, sentAt)` — müşteri detayında "gönderilen mailler" sekmesi.

### 4.4 Arka plan iş kuyruğu

Redis eklemeden **PostgreSQL tabanlı kuyruk** (öneri: `pg-boss`; alternatif: kendi `Job` tablosu + `SELECT … FOR UPDATE SKIP LOCKED`).

- **Worker süreci**: aynı imajdan ikinci container (`node worker.js`) — Dokploy'da ayrı servis. Next.js istek döngüsünden bağımsız.
- **Zamanlayıcı**: Dokploy'daki 6 HTTP cron yerine worker içinde cron tanımları (pg-boss `schedule`), saat dilimi `Europe/Istanbul`. HTTP uç noktaları manuel tetik için kalır.
- **Keşfet → iş üret deseni**: günlük görev yalnızca "işlenecek kayıtları bulur" ve her biri için idempotent anahtarla (`renew-invoice:{serviceId}:{period}`) ayrı iş kuyruğa atar; her iş kendi tekrar denemesine (üstel bekleme, maks. deneme, dead-letter) sahiptir. Tek kayıtta hata tüm görevi düşürmez.
- **Taşınacaklar**: `provisioning/retry-queue.ts` (479 satır kendi kuyruğu) → genel kuyruk; e-fatura gönderimi; bildirimler; outbox işleyici.
- **Admin ekranı**: `/yonetim/kuyruk` — bekleyen/başarısız işler, yeniden dene, son cron çalışmaları (`CronRun` kaydı).

---

## 5. Veri modeli karşılaştırması

> WISECP'nin `install.sql` dosyasındaki ~120 tablo **kavram düzeyinde** gruplandı; kolon listesi/DDL alınmadı.
> Öneriler bizim isimlendirmemizle, mevcut `prisma/schema.prisma` konvansiyonlarına göre yazıldı:
> `cuid()` id, `@@map("snake_case")`, enum'lar büyük harf, `createdAt/updatedAt`, para alanları **`Decimal @db.Decimal(12, 2)`**
> (Faz 1.1 göçünden sonra tüm para alanları bu tipte), sırlar `secrets/crypto.ts` ile şifreli `String`.

### 5.1 Grup bazında karşılaştırma

| # | WISECP tablo grubu (kavram) | KLEACORE karşılığı | Boşluk | Öneri | Faz |
|---|---|---|---|---|---|
| 1 | **Kullanıcılar / kişiler** — hesap, ek profil bilgileri, çoklu adres, özel alanlar, müşteri grupları, alt kullanıcı, son girişler, güvenilir cihaz/passkey, WHOIS kişi profilleri, ülke/il/ilçe sözlükleri | `User` (adres ve vergi bilgisi satır içi), `Session`, `PasswordResetToken` | TCKN alanı yok (iyzico'ya sabit değer gidiyor); faturada müşteri bilgisinin anlık görüntüsü yok (müşteri adresini değiştirince eski fatura değişir); giriş geçmişi yok | `User.identityNumber` (şifreli), `User.phoneVerifiedAt`; `Invoice.billingSnapshot Json` (ad/ünvan, VKN/TCKN, vergi dairesi, adres); `LoginEvent`; alt kullanıcı/grup/WHOIS profili **gereksiz** | 1 (TCKN, snapshot) · 3 (LoginEvent) |
| 2 | **Siparişler / sepet / checkout** — sipariş başlığı, sipariş durum sözlüğü, kalıcı sepet, ödeme oturumu ve oturuma bağlı faturalar | `Order` (tek `productId`/`serviceId`), `OrderItem` (yalnız ad/SKU/fiyat + `configuration Json`), `OrderActivity`; sepet istemci tarafında (`src/store/cart-store.ts`) | Çok kalemli sepette kalem→ürün/hizmet/domain FK'si yok; ödeme oturumu (gateway token, tutar, durum) tablo olarak yok → callback idempotency'si zayıf | `OrderItem`'a `productId`, `serviceId?`, `domainId?`, `billingPeriod`, `itemType` enum; yeni `PaymentAttempt` (aşağıda) | 1 (PaymentAttempt) · 2 (OrderItem FK'leri) |
| 3 | **Faturalar & kalemler** — fatura başlığı, kalemler, fatura-ödeme ilişkisi, gelir/gider defteri, periyodik giderler | `Invoice`, `InvoiceItem` (açıklama/adet/fiyat), `EInvoiceRecord` | `Float`; para birimi yok; kalemin hangi hizmet/domain ve **hangi dönem** için olduğu yok (yenileme mükerrerlik kontrolü `order.serviceId` üzerinden dolaylı); kalem bazında KDV yok; iade durumu yok; ardışık numara sayacı (paralel işte) | `InvoiceItem`: `serviceId?`, `domainId?`, `periodStart?`, `periodEnd?`, `taxRate`, `taxAmount`; `@@unique([serviceId, periodStart])` ile yenileme idempotency; `InvoiceStatus` += `REFUNDED`, `PARTIALLY_REFUNDED`; `Invoice.currency String @default("TRY")`; gelir/gider defteri **gereksiz** (Paraşüt) | 1 |
| 4 | **Ödemeler / bakiye / kayıtlı kart** — fatura ödemeleri, kredi hareketleri, ağ geçidi kart token'ları | `Payment`, `Transaction` (bakiye öncesi/sonrası), `StripeWebhookEvent` | Ağ geçidi bağımsız callback kaydı yok; iade modeli yok; kart token tablosu yok | `PaymentAttempt`, `GatewayEvent` (`StripeWebhookEvent`'in genelleştirilmiş hali), `Refund`; `StoredCard` (yalnız token + son 4 hane) | 1 (Attempt, GatewayEvent, Refund) · 3 (StoredCard) |
| 5 | **Ürünler, fiyatlar, kurlar** — ürün + çeviri, kategori + çeviri, dönem/kur bazlı fiyat tablosu, para birimleri, ürün eklentileri, sipariş sırasında istenen bilgiler (requirements), kullanım metrikleri | `Product`, `ProductCategory` (enum slug), `ProductFeature`, `PricingTier` (dönem bazlı), `ProductConfigOption`, `ProductAddon` | Ürünün hangi modül/sunucu ile kurulacağı yok; addon'lar ürüne değil kategoriye bağlı ve satın alınan addon hizmete kaydedilmiyor; kur tablosu yok; çeviri **gereksiz** | `Product.provisioningModule String?` + `moduleOptions Json` (WHM paket adı, Proxmox şablon/CPU/RAM/disk); `ProductRequirement` (müşteriden istenen alan: tip, zorunlu); `ExchangeRate` | 2 (modül bağı) · 3 (ExchangeRate) · 4 (Requirement) |
| 6 | **Müşteri hizmetleri** — müşterinin ürün örneği, hizmet eklentileri, yükseltme/düşürme kayıtları, abonelikler, metrik kullanım/faturalama, hizmet/lisans devri | `Service`, `ServicePlanChange`, `CancellationRequest`, `ProvisioningJob`, `Backup`, `EmailAccount` | Uzak sistem kimliği (`remoteId`: WHM kullanıcı adı / Proxmox VMID) ve modül örneği yok (`serverName` serbest metin); `ServiceStatus`'ta `PENDING`/`TERMINATED` yok; satın alınan addon'lar kayıtsız; hizmet giriş bilgileri modellenmemiş | `Service`: `moduleInstanceId?`, `remoteId?`, `credentials String?` (şifreli JSON), `terminatedAt?`, `ServiceStatus` += `PENDING`, `TERMINATED`; `ServiceAddon` (addon, fiyat, dönem, durum); abonelik/metrik/devir **gereksiz** | 1 (status, credentials) · 2 (moduleInstance, remoteId, ServiceAddon) |
| 7 | **Domain & TLD fiyatları** — TLD listesi (maliyet, satış, kur, registrar), TLD'ye özel belge gereksinimleri, WHOIS profilleri | `Domain`, `DnsRecord`, `DomainTld` (yalnız satış fiyatları) | Maliyet/kur/registrar yok; `DomainStatus`'ta grace/redemption/iptal/dışarı transfer yok; registrar senkron zamanı, kilit, yenileme tutarı/dönemi yok | `DomainTld`: `costRegister/costRenew/costTransfer`, `costCurrency`, `registrar`, `marginPercent`, `requiresDocuments Boolean`; `Domain`: `registrarRef?`, `lastSyncedAt?`, `isLocked`, `renewalPrice`, `renewalYears`; `DomainStatus` += `GRACE`, `REDEMPTION`, `CANCELLED`, `TRANSFERRED_OUT` | 1 |
| 8 | **Sunucular / modüller / modül kuyruğu** — sunucu tanımı (bağlantı + kapasite), sunucu grupları, başarısız modül çağrıları kuyruğu | `Server` (izleme amaçlı, bağlantı bilgisi yok), `ProvisioningJob`, ayarlar `Setting` anahtarlarında | Modül örneği kavramı yok; aynı türden iki sunucu tanımlanamaz | `ModuleInstance` (aşağıda); `Server.moduleInstanceId?`; grup için ayrı tablo yerine `ModuleInstance.groupKey`; `IpPool`, `IpAddress` | 2 |
| 9 | **Destek** — ticket, yanıtlar, ekler, departmanlar (+çeviri), özel durumlar, özel alanlar, erişim grupları, hazır yanıtlar ve kullanım sayıları, okundu işaretleri, ticket görevleri, duyurular, POP3 ile gelen mesajlar | `SupportTicket`, `TicketMessage` (`attachments Json`), sabit `TicketDepartment` enum | Ek dosyalar için ayrı kayıt (boyut, tip, depolama yolu) yok; hazır yanıt yok; gelen e-posta kaydı yok; iç not ayrımı yok | `TicketAttachment`, `TicketMessage.isInternal`, `CannedReply`, `InboundEmail` (Message-ID unique); departman enum'u kalır; özel alan/erişim grubu/görev **gereksiz** | 3 |
| 10 | **Personel / yetkiler** — yetki grupları ve izin listeleri | `UserRole` = `ADMIN`/`CUSTOMER` | Destek-only personel tanımlanamaz | `UserRole` += `SUPPORT`, `BILLING`; izin tablosu yerine kodda rol→yetki haritası | 3 |
| 11 | **Bildirimler / şablonlar** — şablonlar, şablon gönderim logları, bildirim kuyruğu, mail logu, SMS logu, müşteri hatırlatıcıları | `Notification` (panel içi) | Şablon tablosu, gönderim logu, kuyruk yok | `NotificationLog` (Faz 1), `NotificationTemplate` (Faz 3); kuyruk = genel iş kuyruğu (pg-boss kendi tablolarını yönetir, Prisma modeli gerekmez) | 1 · 3 |
| 12 | **Ayarlar** — anahtar/değer yapılandırma | `Setting` (group/key/value/type) | Modül sırları ve şemalar ayarlarla karışık | Genel ayarlar `Setting`'de kalır; modül yapılandırması `ModuleInstance.config`'e taşınır | 2 |
| 13 | **Loglar / olaylar / koruma** — kullanıcı işlemleri, hata imzaları, API logları, throttle kayıtları, engelli IP/e-posta, spam kayıtları, olay tablosu | `ActivityLog`, `OrderActivity`, `RateLimitBucket` | Kalıcı olay (outbox) yok; cron çalışma kaydı yok; engelleme listesi yok | `CronRun` (Faz 1), `DomainEvent` outbox (Faz 3), `BlockedEntry` (IP/e-posta/telefon, sebep, bitiş) (Faz 4) | 1 · 3 · 4 |
| 14 | **Cron / iş kuyruğu** — keşfedilen işler kuyruğu, görev çalışma süreleri, görev meta verisi | `ProvisioningJob` (yalnız provisioning) | Genel kuyruk yok | pg-boss şeması (Prisma dışı, ayrı `pgboss` schema) + `CronRun`; `ProvisioningJob` Faz 2 sonunda emekliye ayrılır | 1 → 2 |
| 15 | **Kupon / promosyon** — kupon tanımları, kampanyalar | `PromotionCode` (+ `Order.promoCodeId`) | `Float` değerler; kategori/ürün kısıtları `Json` | Decimal göçü yeterli; kullanım sayımı `Order.promoCodeId` üzerinden zaten mümkün | 1 (yalnız Decimal) |
| 16 | **Affiliate** — ortaklar, tıklamalar, yönlendirenler, komisyon hareketleri, çekim talepleri | `AffiliateReferral`, `AffiliatePayment`, `User.affiliateCode` | — | **Gereksiz** — mevcut model dondurulur, yeni tablo yok | — |
| 17 | **KYC / fraud / KVKK** — belge alan tanımları, belge filtreleri (hangi müşteri/ürüne zorunlu), yüklenen belgeler, fraud tespit kayıtları, GDPR talepleri, çerez onay logu | Yok | VDS kötüye kullanım ve yasal onay kaydı yok | `ConsentRecord` (mesafeli satış/ön bilgilendirme/KVKK onayı: belge sürümü, IP, zaman, sipariş) (Faz 1); `KycDocument` (Faz 4); `FraudCheck` (sipariş, skor, kurallar, karar) (Faz 4); `DataRequest` (KVKK) (Faz 4) | 1 · 4 |
| 18 | **API** — API kimlikleri, oran sınırları, idempotency anahtarları, kötüye kullanım koruması, API logları | `ApiKey`, `RateLimitBucket` | Scope ve idempotency yok | `ApiKey.scopes String[]`, `IdempotencyKey` | 4 |
| 19 | **Yedekleme** — yedek kayıtları, geri yükleme kayıtları, zamanlama, depolama hedefleri | `Backup`, `BackupSchedule` (müşteri hizmet yedekleri) | Sistem (DB) yedeği ve hedef kaydı yok | `SystemBackupRun` (hedef, boyut, sağlama toplamı, durum); hedef = `ModuleInstance(kind: STORAGE)` | 1 (SystemBackupRun) · 2 (hedef modülü) |
| 20 | **Site içeriği** — sayfalar, menüler, slaytlar, haberler, yorumlar, müşteri yorumları, referanslar, sözleşmeler, bültenler, ziyaretçiler | `BlogPost`, `KnowledgeBaseArticle`, `ContactMessage`, `SystemStatus`, `SystemIncident`; vitrin sayfaları kodda | — | **Gereksiz** (vitrin kodda kalır); yalnız sözleşme metinleri sürümlenmeli → `LegalDocument` (slug, version, body, publishedAt) `ConsentRecord` ile birlikte | 1 (LegalDocument) |
| 21 | **Eklentiler / güncellemeler** — eklenti kayıtları, çekirdek güncelleme kayıtları | — | — | **Gereksiz** (kod deposu + deploy) | — |

### 5.2 Önerilen yeni / değişen Prisma modelleri

Faz 1 (gerçek ödeme almadan önce):

```prisma
enum PaymentAttemptStatus { CREATED REDIRECTED SUCCEEDED FAILED EXPIRED }
enum RefundStatus { PENDING COMPLETED FAILED }
enum NotificationChannel { EMAIL SMS }
enum DeliveryStatus { QUEUED SENT FAILED SKIPPED }
enum CronRunStatus { RUNNING SUCCEEDED FAILED SKIPPED_LOCKED }

model PaymentAttempt {
  id            String               @id @default(cuid())
  customerId    String
  customer      User                 @relation(fields: [customerId], references: [id])
  gateway       String               // "paytr" | "iyzico" | "bank_transfer" | "balance"
  gatewayRef    String               // PayTR merchant_oid / iyzico token / havale referansı
  amount        Decimal              @db.Decimal(12, 2)
  currency      String               @default("TRY")
  status        PaymentAttemptStatus @default(CREATED)
  invoiceIds    String[]
  context       String               // "order" | "invoice" | "renewal" | "balance"
  failureReason String?
  completedAt   DateTime?
  createdAt     DateTime             @default(now())
  updatedAt     DateTime             @updatedAt
  payments      Payment[]
  @@unique([gateway, gatewayRef])
  @@index([customerId, createdAt])
  @@map("payment_attempts")
}

model GatewayEvent {            // StripeWebhookEvent'in yerini alır
  id          String    @id @default(cuid())
  gateway     String
  externalId  String    // callback'teki benzersiz kimlik
  payload     Json
  signatureOk Boolean
  processedAt DateTime?
  error       String?
  receivedAt  DateTime  @default(now())
  @@unique([gateway, externalId])
  @@map("gateway_events")
}

model Refund {
  id          String       @id @default(cuid())
  paymentId   String
  payment     Payment      @relation(fields: [paymentId], references: [id])
  invoiceId   String
  amount      Decimal      @db.Decimal(12, 2)
  reason      String
  status      RefundStatus @default(PENDING)
  gatewayRef  String?
  toBalance   Boolean      @default(false)   // karta değil bakiyeye iade
  processedBy String?
  createdAt   DateTime     @default(now())
  completedAt DateTime?
  @@index([invoiceId])
  @@map("refunds")
}

model NotificationLog {
  id                String              @id @default(cuid())
  userId            String?
  channel           NotificationChannel
  templateKey       String              // "invoice.created", "domain.expiring" ...
  recipient         String
  subject           String?
  status            DeliveryStatus      @default(QUEUED)
  providerMessageId String?
  error             String?
  entity            String?
  entityId          String?
  sentAt            DateTime?
  createdAt         DateTime            @default(now())
  @@index([userId, createdAt])
  @@index([entity, entityId])
  @@map("notification_logs")
}

model CronRun {
  id         String        @id @default(cuid())
  job        String
  status     CronRunStatus @default(RUNNING)
  startedAt  DateTime      @default(now())
  finishedAt DateTime?
  processed  Int           @default(0)
  failed     Int           @default(0)
  summary    Json?
  @@index([job, startedAt])
  @@map("cron_runs")
}

model LegalDocument {
  id          String          @id @default(cuid())
  slug        String          // "mesafeli-satis", "on-bilgilendirme", "kvkk"
  version     Int
  body        String
  publishedAt DateTime        @default(now())
  consents    ConsentRecord[]
  @@unique([slug, version])
  @@map("legal_documents")
}

model ConsentRecord {
  id         String        @id @default(cuid())
  userId     String
  documentId String
  document   LegalDocument @relation(fields: [documentId], references: [id])
  orderId    String?
  ipAddress  String
  userAgent  String?
  acceptedAt DateTime      @default(now())
  @@index([userId])
  @@map("consent_records")
}

model SystemBackupRun {
  id         String   @id @default(cuid())
  target     String   // "sftp:pve2", "s3:r2" ...
  sizeBytes  BigInt?
  sha256     String?
  status     String   // "succeeded" | "failed"
  error      String?
  startedAt  DateTime @default(now())
  finishedAt DateTime?
  @@map("system_backup_runs")
}
```

Faz 1 değişiklikleri (mevcut modeller): tüm para alanları `Decimal`; `User.identityNumber`; `Invoice.billingSnapshot Json`, `Invoice.currency`; `InvoiceItem.{serviceId, domainId, periodStart, periodEnd, taxRate, taxAmount}` + `@@unique([serviceId, periodStart])` ve `@@unique([domainId, periodStart])`; `InvoiceStatus` += `REFUNDED`, `PARTIALLY_REFUNDED`; `Payment.attemptId`; `ServiceStatus` += `PENDING`, `TERMINATED`; `Service.credentials`; `Domain.{registrarRef, lastSyncedAt, isLocked, renewalPrice, renewalYears}`; `DomainStatus` += `GRACE`, `REDEMPTION`, `CANCELLED`, `TRANSFERRED_OUT`; `DomainTld.{costRegister, costRenew, costTransfer, costCurrency, registrar, marginPercent}`.

Faz 2 (modül/altyapı):

```prisma
enum ModuleKind { PAYMENT REGISTRAR SERVER DNS SMS MAIL STORAGE EINVOICE }

model ModuleInstance {
  id         String     @id @default(cuid())
  kind       ModuleKind
  moduleId   String     // "cpanel-whm", "proxmox", "paytr", "gri", "cloudflare" ...
  label      String     // "WHM Bayi 1", "PVE DCNET"
  config     String     // şifreli JSON (secrets/crypto.ts), şema manifest'te
  groupKey   String?    // aynı ürün için sunucu havuzu
  isActive   Boolean    @default(true)
  priority   Int        @default(0)
  capacity   Int?       // maks. hesap/VM; doluluk seçimi için
  lastHealthAt DateTime?
  lastHealthOk Boolean?
  services   Service[]
  servers    Server[]
  createdAt  DateTime   @default(now())
  updatedAt  DateTime   @updatedAt
  @@index([kind, isActive])
  @@map("module_instances")
}

model ServiceAddon {
  id         String        @id @default(cuid())
  serviceId  String
  service    Service       @relation(fields: [serviceId], references: [id], onDelete: Cascade)
  addonId    String
  addon      ProductAddon  @relation(fields: [addonId], references: [id])
  amount     Decimal       @db.Decimal(12, 2)
  billingPeriod BillingPeriod
  status     ServiceStatus @default(ACTIVE)
  nextDueDate DateTime?
  createdAt  DateTime      @default(now())
  updatedAt  DateTime      @updatedAt
  @@index([serviceId])
  @@map("service_addons")
}

model IpPool {
  id               String      @id @default(cuid())
  name             String
  cidr             String
  gateway          String
  moduleInstanceId String?     // hangi Proxmox node/cluster
  addresses        IpAddress[]
  @@map("ip_pools")
}

model IpAddress {
  id         String    @id @default(cuid())
  poolId     String
  pool       IpPool    @relation(fields: [poolId], references: [id])
  address    String    @unique
  serviceId  String?   @unique
  reserved   Boolean   @default(false)
  assignedAt DateTime?
  @@map("ip_addresses")
}
```

Faz 2 değişiklikleri: `Product.{provisioningModule, moduleOptions}`; `Service.{moduleInstanceId, remoteId}` + `@@index([moduleInstanceId])`, `serverName` kaldırılır; `Server.moduleInstanceId`; `OrderItem.{productId, serviceId, domainId, billingPeriod, itemType}`; `StripeWebhookEvent` ve `ProvisioningJob` emekliye ayrılır (veri `GatewayEvent`/kuyruğa taşınır).

Faz 3 (operasyon) — kısa tanımlar:
- `NotificationTemplate { key, channel, locale @default("tr"), subject?, body, isActive, updatedBy; @@unique([key, channel, locale]) }`
- `DomainEvent { type, payload Json, occurredAt, processedAt?, attempts, lastError?; @@index([processedAt, occurredAt]) }` (outbox)
- `TicketAttachment { messageId, fileName, mimeType, sizeBytes, storageKey, sha256 }`, `TicketMessage.isInternal Boolean`
- `CannedReply { title, body, department TicketDepartment?, usageCount }`
- `InboundEmail { messageId @unique, fromAddress, subject, ticketId?, status, rawStorageKey, receivedAt }`
- `StoredCard { userId, gateway, cardToken (şifreli), cardUserKey?, last4, brand, expMonth, expYear, isDefault }`
- `ExchangeRate { base, quote, rate Decimal(18,6), source @default("TCMB"), date; @@unique([base, quote, date]) }`
- `LoginEvent { userId?, email, ipAddress, userAgent?, success, reason?, createdAt; @@index([userId, createdAt]) }`
- `UserRole` += `SUPPORT`, `BILLING`

Faz 4 (opsiyonel): `KycDocument`, `FraudCheck`, `DataRequest`, `BlockedEntry`, `ProductRequirement`, `IdempotencyKey`, `ApiKey.scopes`.

### 5.3 Şema göç notları

- Decimal göçü tek migration'da yapılmalı (`ALTER COLUMN … TYPE numeric(12,2) USING round(col::numeric, 2)`), öncesinde `pg_dump`; kodda `Number(...)` dönüşümleri `Prisma.Decimal` ile değiştirilmeli (`roundMoney` kullanan yerler: `cron/jobs/generate-renewal-invoices.ts`, `billing/tax.ts`, `services/plan-change.ts`, `payments/*`).
- Enum genişletmeleri (`ServiceStatus`, `DomainStatus`, `InvoiceStatus`, `UserRole`) geriye uyumlu; mevcut `switch`'lerde `never` kontrolü derleme hatasıyla eksik dalları gösterir.
- `InvoiceItem` dönem alanları eski kayıtlar için `null` kalır; unique index `NULL`'ları çakıştırmaz (PostgreSQL), yani geçmiş veri migration'ı bloklamaz.
- `ModuleInstance`'a geçişte mevcut `Setting` anahtarları (`cpanel_*`, `vps_vds_*`, `registrar_*`, `paytr_*`, `iyzico_*`, `sms_*`) bir data-migration script'iyle tek seferlik örneklere dönüştürülür; okuma katmanı bir sürüm boyunca iki kaynağı da destekler.

---

## 6. Fazlar

> Efor: tek geliştirici + AI ajanları, "gün" = odaklı iş günü. Kabul kriterleri test edilebilir yazıldı.

### Faz 0 — Devam eden işler (bu belgenin dışında)

Güvenlik (2FA bypass, rate limit, oturum yenileme), ödeme bütünlüğü (çift fulfillment, ardışık fatura no, ödemede askıdan çıkarma, grace period), platform (Next/next-auth yükseltme, container göçü, health check, cron düzeltmesi, güvenlik başlıkları).
**Faz 1 bunların bitmesine bağımlıdır.**

### Faz 1 — Gerçek ücretli müşteri almak için güvenli taban (≈22-28 gün)

| # | Teslimat | Efor | Bağımlılık |
|---|---|---|---|
| 1.1 | **Para alanlarını `Decimal`e taşı** (Invoice/Order/Payment/Service/User.balance/Transaction…); `roundMoney` yardımcılarını tek modüle topla | 3-4 | Faz 0 ödeme bütünlüğü |
| 1.2 | **Domain yenileme döngüsü**: yenileme cron'u `Domain` tablosunu da tarar (30/15/7 gün önce fatura), ödeme → `renewDomainWithRegistrar` (iş kuyruğu + tekrar deneme), `Domain.expiresAt` güncellenir; `autoRenew=false` ise fatura kesilmez | 3 | 1.4 |
| 1.3 | **Domain süre bildirimleri + Gri durum senkronu**: yaklaşan (30/7/1), süresi doldu, grace/redemption uyarıları; günlük Gri `getDomainInfo` ile expiry/status eşitleme | 2-3 | 1.2 |
| 1.4 | **Minimal iş kuyruğu + cron kilidi + çalışma kaydı**: pg-boss (veya Job tablosu), `CronRun` tablosu, aynı görevin eşzamanlı çalışmasını engelleme; mevcut 6 görev buraya bağlanır | 3-4 | Faz 0 cron düzeltmesi |
| 1.5 | **Çoklu ödeme yöntemi**: PayTR + iyzico + havale aynı anda aktif; varsayılan `stripe` kaldırılır; havale için banka hesapları ayarı + müşteri dekont/açıklama alanı; callback'ler idempotent (gateway referansı unique) | 2-3 | Faz 0 |
| 1.6 | **İade kaydı**: admin'den iade (tam/kısmi) → PayTR/iyzico iade API'si veya manuel, fatura "iade edildi", Paraşüt'te iade faturası/iptal notu | 2-3 | 1.1, 1.8 |
| 1.7 | **Bildirim tabanı**: eksik kritik şablonlar (hoş geldin + e-posta doğrulama, hizmet aktif/giriş bilgileri, domain kayıt/yenileme, iptal, şifre değişti), `NotificationLog`, kuyruk üzerinden gönderim | 3 | 1.4 |
| 1.8 | **Paraşüt uçtan uca doğrulama**: canlı hesapta e-arşiv + e-fatura mükellefi senaryosu, KDV satırları, hata durumunda admin uyarısı ve `retryEInvoiceRecord` ekranı | 1-2 | 1.1 |
| 1.9 | **Off-site DB yedeği**: `backup-postgres.sh` → şifreli (age/gpg) SFTP/S3 hedefine günlük, 30 gün saklama; aylık geri yükleme provası belgesi | 1-2 | — |
| 1.10 | **Turnstile + e-posta doğrulama zorunluluğu**: kayıt, giriş (n hatalı denemeden sonra), şifre sıfırlama, iletişim formu | 1 | — |
| 1.11 | **Askıya alma kapsamı düzeltmesi**: hizmete bağlı olmayan gecikmiş fatura tüm hizmetleri askıya almasın (`suspend-overdue-services.ts`); otomatik fesih için yalnız "fesih adayları" listesi (otomatik silme yok) | 1 | Faz 0 grace period |
| 1.12 | **Manuel provisioning akışı**: modülü olmayan ürün (ve Proxmox gelene kadar VDS) ödendiğinde admin'e görev + SMS, admin bilgileri girip "aktifleştir" der, müşteriye bilgi maili gider | 1-2 | 1.7 |
| 1.13 | Yasal/ticari kontrol: mesafeli satış sözleşmesi + ön bilgilendirme formunun sipariş anında onaylanıp siparişe kaydedilmesi (zaman damgası, IP) | 1 | — |

> Faz 1 şema eklemeleri: §5.2 "Faz 1" bloğu (PaymentAttempt, GatewayEvent, Refund, NotificationLog, CronRun, LegalDocument/ConsentRecord, SystemBackupRun + mevcut modellerde Decimal/enum/alan değişiklikleri). 1.1 ile tek migration serisi olarak planlanmalı.

**Kabul kriterleri (Faz 1):**
- Staging'de uçtan uca: yeni müşteri kayıt (doğrulama maili) → hosting + .com.tr sepeti → PayTR 3D test ödemesi → WHM hesabı açıldı + Gri'de domain kaydedildi → Paraşüt'te e-arşiv taslağı → müşteriye 3 mail (sipariş, ödeme, hizmet aktif) `NotificationLog`'da "sent".
- Domain `expiresAt` = bugün+30 olan kayıt için cron fatura üretir; ödeme sonrası Gri'de yenilenir ve `expiresAt` +1 yıl olur; aynı cron iki kez çalıştırıldığında ikinci fatura oluşmaz.
- Aynı PayTR callback'i 3 kez gönderildiğinde tek `Payment`, tek fulfillment.
- Kuruş testi: 0,1 + 0,2 tipli tutarlar ve %20 KDV'li 1.000 kalem faturada fatura toplamı = satır toplamı (Decimal).
- Kuyruktaki başarısız iş admin ekranında görünür ve "yeniden dene" ile tamamlanır.
- Off-site yedekten boş bir Postgres'e geri yükleme yapılıp uygulama açılıyor (prova kaydı).
- Ödeme sayfasında PayTR, iyzico ve havale aynı anda seçilebiliyor.

### Faz 2 — Altyapı otomasyonu: Proxmox, çoklu sunucu, Cloudflare, içe aktarma (≈20-26 gün)

| # | Teslimat | Efor | Bağımlılık |
|---|---|---|---|
| 2.1 | **Modül kaydı + `ModuleInstance`** (§4.2); mevcut sağlayıcılar yeni kayda taşınır, ayar formu şemadan üretilir | 4-5 | Faz 1 |
| 2.2 | **Ürün→modül→sunucu bağı**: `Product.moduleOptions`, `Service.moduleInstanceId/remoteId`; `Server` modeli `ModuleInstance`'a bağlanır; en az dolu sunucu seçimi | 2-3 | 2.1 |
| 2.3 | **Proxmox VE modülü**: API token ile şablondan klon (cloud-init: kullanıcı, SSH anahtarı, IP), CPU/RAM/disk ayarı, başlat/durdur/yeniden başlat, askıya alma (durdur + kilitle), fesih (yedek al → sil), paket değişimi (kaynak güncelle + disk büyüt), noVNC konsol bağlantısı, yeniden kurulum | 6-8 | 2.2, 2.4 |
| 2.4 | **IP havuzu (mini IPAM)**: `IpPool/IpAddress` tabloları, VDS kurulumunda otomatik atama, fesihte serbest bırakma | 2 | 2.2 |
| 2.5 | **Cloudflare DNS modülü**: hosting/VDS aktivasyonunda zone/A kaydı, müşteri DNS ekranı Cloudflare'e yazar (registrar DNS yerine), NS'ler Cloudflare'e işaret ediyorsa | 3 | 2.1 |
| 2.6 | **cPanel SSO + kullanım senkronu**: müşteri panelinden tek tıkla cPanel/Webmail girişi; günlük disk/bant genişliği sync → `Service.diskUsed` vb. | 2 | 2.1 |
| 2.7 | **İçe aktarma araçları**: WHM `listaccts`, Proxmox VM listesi, Gri domain listesi → önizleme ekranı → müşteri eşleme → `Service`/`Domain` kayıtları (vade tarihleri elle düzeltilebilir) | 3-4 | 2.2, 2.3 |

> Faz 2 şema eklemeleri: §5.2 "Faz 2" bloğu (ModuleInstance, ServiceAddon, IpPool/IpAddress, Product/Service/OrderItem bağları).

**Kabul kriterleri (Faz 2):**
- VDS ürünü PayTR ile alındığında 5 dk içinde Proxmox'ta VM ayağa kalkar, IP atanır, müşteri SSH ile bağlanır; askıya alma → VM durur ve müşteri başlatamaz; ödeme → çalışır.
- İki WHM sunucusu tanımlıyken yeni hosting siparişi daha az dolu olana gider.
- Müşterinin DNS ekranında eklediği A kaydı Cloudflare API'de görünür.
- Bayi sunucudaki mevcut hesapların ≥%95'i içe aktarma sihirbazıyla doğru müşteri/ürün/vadeyle `Service` olur.

### Faz 3 — Operasyon olgunluğu: bildirim, destek, rapor, tahsilat (≈18-22 gün)

| # | Teslimat | Efor | Bağımlılık |
|---|---|---|---|
| 3.1 | **Outbox olay sistemi** (§4.3) + ~30 olay; webhook/activity log/e-fatura abonelere taşınır | 3 | Faz 1 kuyruk |
| 3.2 | **Şablon yönetimi**: DB şablonları, admin editörü + önizleme + test gönderimi, SMS şablonları | 3 | 3.1 |
| 3.3 | **Otomatik hatırlatma takvimi**: vade -3/-1, +1/+3/+7 e-posta/SMS; askıya alma öncesi son uyarı | 1-2 | 3.2 |
| 3.4 | **E-posta → ticket (IMAP)**: destek@ kutusu periyodik okunur, müşteri eşlenir, yanıtlar ticket'a eklenir, imza/alıntı temizliği | 3-4 | Faz 1 kuyruk |
| 3.5 | **Destek kolaylıkları**: hazır yanıtlar, X gün yanıtsız otomatik kapatma, ek dosya güvenli depolama (boyut/tip sınırı) | 2 | — |
| 3.6 | **Personel rolü**: `SUPPORT` (yalnız ticket + müşteri görüntüleme), `BILLING`; admin işlemlerinde rol kontrolü | 2-3 | — |
| 3.7 | **Kayıtlı kart + otomatik tahsilat** (PayTR kart saklama veya iyzico): vadede otomatik çekim, başarısızsa bildirim | 3-4 | 1.5, 3.1 |
| 3.8 | **Raporlar**: MRR, churn, KDV tahakkuk (Paraşüt mutabakatı), gelir-maliyet (domain USD maliyeti dahil) | 2 | 3.9 |
| 3.9 | **TCMB kur senkronu**: günlük USD/EUR; Gri TLD maliyeti → TRY satış fiyatı (marj kuralı) | 1 | — |

> Faz 3 şema eklemeleri: NotificationTemplate, DomainEvent, TicketAttachment, CannedReply, InboundEmail, StoredCard, ExchangeRate, LoginEvent, UserRole genişletmesi (§5.2).

**Kabul kriterleri (Faz 3):** Her olay için bir gönderim logu satırı; destek@'e gelen mail 5 dk içinde ticket; SUPPORT rolü fatura sayfasına 403 alır; kayıtlı kartlı müşteride vadede çekim otomatik ve fatura PAID; TLD fiyatları kur değişince marja göre güncellenir.

### Faz 4 — Opsiyonel / talebe bağlı (≈10-15 gün, parça parça)

| Teslimat | Efor | Ne zaman |
|---|---|---|
| Basit fraud kuralları (ilk sipariş VDS + yabancı IP/kart → manuel onay) | 2 | VDS kötüye kullanım görülürse |
| KYC (kimlik/vergi levhası yükleme + admin onayı) | 2-3 | VDS satış hacmi artınca |
| KVKK veri talebi formu, başarısız giriş bildirimi, güvenilir cihaz | 2 | |
| Toplu duyuru (bakım e-posta/SMS) | 1-2 | |
| Teklif/proforma (ajans projeleri) | 2-3 | Ajans faturalaması KLEACORE'a alınırsa |
| İkinci registrar (OpenProvider vb.) | 3-4 | Gri'de olmayan TLD ihtiyacı |
| Proxmox yedek (vzdump/PBS) tetikleme + müşteri görünümü | 2 | |
| Admin API + scope (AI ajanları için) | 2-3 | |
| Resend/SES + bounce takibi | 1 | Teslim sorunları olursa |

### Bilinçli olarak yapılmayacaklar (gereksiz)

Çoklu dil, çoklu para birimiyle satış, sosyal giriş, WHMCS/Blesta/WISECP içe aktarma, SSL bayiliği, abonelik ağ geçitleri, metrik bazlı faturalama, hizmet devri, alt kullanıcılar, ziyaretçi analitiği, lisans ürünleri, uluslararası SMS satışı, 220+ ödeme / 85+ registrar / 40+ panel modülü, Virtualizor bakımı, affiliate/bayilik geliştirmesi (mevcut kod dondurulur).

---

## 7. Riskler & açık kararlar

### Riskler

| # | Risk | Etki | Azaltma |
|---|---|---|---|
| R1 | Domainler yenilenmeden düşer (`renewDomain` çağrılmıyor) | Müşteri sitesi/maili kapanır, itibar | Faz 1.2-1.3 tamamlanana kadar Gri panelinde otomatik yenileme açık tutulmalı + haftalık manuel kontrol |
| R2 | `Float` para alanları | Kuruş farkı, Paraşüt ile mutabakat hatası | Faz 1.1; göç öncesi tüm tutarların yedeği |
| R3 | Off-site DB yedeği yok | Tek disk arızasında tüm müşteri/fatura verisi kaybı (geçmişte ~/.claude kaybı yaşandı) | Faz 1.9 ilk hafta |
| R4 | Gecikmiş fatura → müşterinin tüm hizmetleri askıya alınabilir | Haksız kesinti | Faz 1.11 |
| R5 | iyzico'da TCKN yoksa sabit `11111111111` gönderiliyor (`payment-gateways/providers/iyzico.ts:66`) | iyzico risk/uyum sorunu | Kurumsal: VKN, bireysel: TCKN zorunlu alan |
| R6 | Proxmox otomasyonu olmadan VDS satışı | Manuel iş yükü, gecikmeli teslim | Faz 1.12 manuel akış, Faz 2.3 |
| R7 | Kuyruk/worker eklenmesi deploy karmaşıklığını artırır | Ek container | Aynı imaj, Dokploy'da ikinci servis; health check'e worker kalp atışı |
| R8 | Ana plan belgesi (`KLEACORE-WISECP-MASTER-PLAN.md`) eski | Yanlış önceliklendirme | Bu belge esas alınmalı; eski plan "arşiv" notuyla işaretlenmeli |
| R9 | Stub sağlayıcılar (Sectigo, Let's Encrypt) `ok: true` dönüyor | Müşteri "SSL kuruldu" sanır | Ürünler gizlenmeli veya sağlayıcı `disabled` |

### Sahibin vermesi gereken kararlar

1. **VDS satışı Faz 1'de mi?** Evet ise Proxmox (2.3) Faz 1'e çekilir (+7 gün) veya manuel akışla (1.12) başlanır. Öneri: manuel akışla başla, Faz 2'de otomatikleştir.
2. **Birincil sanal POS: PayTR mi iyzico mu?** Komisyon ve valör karşılaştırması; ikisi de açık olacaksa müşteri hangisini görecek (tek buton + arka planda yönlendirme mi, iki seçenek mi)?
3. **Resmi belge:** KLEACORE PDF'i yalnız "proforma/bilgi" mi olacak, resmi fatura yalnız Paraşüt e-arşiv/e-fatura mı? (Öneri: evet; KLEACORE numarası iç referans, Paraşüt numarası resmi.)
4. **Grace period ve fesih süreleri:** örn. vade +3 gün askı, +30 gün fesih adayı; domain için registrar grace süresine göre.
5. **Kuyruk teknolojisi:** `pg-boss` (hazır, Postgres) mi, kendi `Job` tablosu mu? Öneri: pg-boss.
6. **DNS'in sahibi:** müşteri domainleri Cloudflare'de mi (bizim hesap), Gri DNS'te mi kalacak? Karışık model DNS ekranını iki yola böler.
7. **Off-site yedek hedefi:** SFTP (pve2/DCNET), Backblaze B2 / Cloudflare R2 veya Google Drive.
8. **Affiliate/bayilik kodu:** dondurulsun mu (gizle) yoksa silinsin mi? Öneri: menüden gizle, kod kalsın.
9. **Mevcut müşterilerin taşınması:** WHM/Gri/Proxmox içe aktarma (Faz 2.7) mi, yoksa yalnız yeni müşteriler KLEACORE'dan mı?
10. **KYC zorunluluğu:** VDS siparişlerinde kimlik/vergi levhası istenecek mi (kötüye kullanım ve 5651 sayılı kanun loglama yükümlülüğü açısından)?

## 8. Sahip kararları (08.10.2026)

| # | Karar |
|---|---|
| 1 | **VDS Faz 1'de satılır.** Faz 1'de manuel kurulum akışı (sipariş → yönetici kurulum görevi → teslim e-postası); Proxmox otomasyonu Faz 2'nin ilk işi. |
| 2 | **Birincil sanal POS: Kuveyt Türk.** Kuveyt Türk VPOS (3D Secure) sağlayıcısı Faz 1'e eklenir ve varsayılan kart ödeme yöntemi olur; PayTR/iyzico ikincil kalır. |
| 3 | **Resmi fatura: kendi modülümüz.** (Kapsamı netleştirilecek — bkz. açık soru.) |
| 4 | **Süreler:** vade + 3 gün askı, vade + 30 gün fesih adayı; domainlerde registrar grace süresi. |
| 5 | **Kuyruk:** pg-boss. |
| 6–10 | Bekliyor: DNS sahipliği, off-site yedek (sonra), affiliate/bayilik, mevcut müşteri aktarımı, VDS KYC. |
