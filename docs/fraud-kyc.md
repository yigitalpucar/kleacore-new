# Sipariş risk incelemesi (fraud) + kimlik doğrulama (KYC)

Faz 4 (YOL-HARITASI §6). VDS satışı başladı; 5651 sayılı Kanun gereği sunucu hizmeti verilen kişinin
tespit edilebilmesi gerekiyor. İki parça birlikte çalışır ve **aynı bekletme (hold) mekanizmasını**
kullanır: ödeme alınabilir, ama kurulum onaya kadar bekler.

## 1. Risk kuralları (`src/lib/fraud/`)

| Kural (`rule`) | Varsayılan puan | Ne zaman eşleşir |
|---|---|---|
| `first_order_server` | 30 | Müşterinin ilk (iptal edilmemiş) siparişi ve ürün sunucu kategorisinde (vds, vps, server, cloud, datacenter) |
| `ip_country_foreign` | 25 | Sipariş IP'sinin ülkesi biliniyor ve TR değil (Tor `T1` dahil) |
| `card_country_foreign` | 25 | Ödeme kuruluşu kartın BIN ülkesini bildirdiyse ve TR değilse |
| `disposable_email` | 40 | E-posta alan adı paketli geçici e-posta listesinde (`disposable-domains.ts`) |
| `ip_velocity` | 20 | Aynı IP'den son 24 saatte (bu sepetin siparişleri hariç) ≥ `fraud_same_ip_limit` (3) sipariş |
| `name_mismatch` | 20 | Kart sahibi adı ile fatura adı/firma adı ortak hiçbir kelime içermiyor (Türkçe karakter katlanır) |
| `new_account` | 15 | Hesap 24 saatten yeni |

- Puanlar toplanır. Toplam ≥ `fraud_review_threshold` (50) → **İnceleme bekliyor** (`FraudCheck.status = REVIEW`).
  Örnek: ilk VDS siparişi + yabancı IP = 55 → inceleme (yol haritasındaki "ilk sipariş VDS + yabancı IP/kart → manuel onay").
- Toplam ≥ `fraud_block_threshold` (varsayılan 0 = kapalı) → onaya kadar **ödeme alınmaz**: sepet ödeme oturumu açmaz,
  `payInvoice`, kayıtlı kartla ödeme ve Kuveyt Türk kart formu reddeder (`getPaymentBlock`). Reddedilen siparişin de ödemesi alınmaz.
- Değerlendirme zamanları:
  1. **Sipariş (checkout)**: `checkoutCart` transaction'ında sipariş başına bir `FraudCheck` satırı (savepoint içinde; hata satışı durdurmaz).
  2. **Ödeme**: kart verisi bilindiğinde kart kuralları yeniden puanlanır (`reevaluateOrderAtPayment`). PASSED → REVIEW olabilir;
     personelin verdiği karar (APPROVED/REJECTED) değişmez. Kart sahibi adı yalnızca karşılaştırılır, saklanmaz.
     - Kuveyt Türk: kart sahibi adı bizim formumuzda girildiği için 3D başlatılmadan önce değerlendirilir.
     - BIN ülkesi: `GatewayPaymentConfirmation.card.binCountry` alanı hazır; bugün hiçbir aktif sağlayıcı ülke döndürmüyor
       (PayTR/iyzico/Kuveyt callback'lerinde yok; Stripe'ta ek API çağrısı gerekir). Bir sağlayıcı eklenirse callback'inde doldurmak yeterli.
- Ayarlar: **Siparişler → İnceleme → Kurallar ve ayarlar** (`/yonetim/siparisler/inceleme/ayarlar`, `settings.manage`).
  Anahtarlar: `fraud_enabled`, `fraud_review_threshold`, `fraud_block_threshold`, `fraud_same_ip_limit`,
  `fraud_trust_cf_header`, `fraud_weight_<kural>`.

### IP → ülke

1. **Cloudflare `CF-IPCountry` başlığı** (yalnız proxy'li `www.kleacore.com` isteklerinde gerçek). `kleacore.com` kökü
   proxy'siz olduğundan istemci başlığı sahte gönderebilir: sahte "yabancı" ülke saldırgana bir şey kazandırmaz, sahte "TR"
   riski gizler. Bu yüzden **çevrimdışı veritabanının çeliştiği "TR" başlığı yok sayılır**; diğer durumlarda başlık önce gelir.
   `fraud_trust_cf_header=false` başlığı tamamen kapatır.
2. **Çevrimdışı veritabanı** `ip_country_ranges` (MaxMind GeoLite2 lisans anahtarı istediği için kullanılmadı):
   db-ip.com **IP to Country Lite** (CC BY 4.0, aylık, IPv4+IPv6). Yükleme:

   ```bash
   # https://db-ip.com/db/download/ip-to-country-lite → dbip-country-lite-YYYY-MM.csv.gz
   pnpm fraud:load-ip-db ./dbip-country-lite-2026-10.csv.gz            # tabloyu tek transaction'da değiştirir
   pnpm fraud:load-ip-db ./dosya.csv --dry-run                          # yalnız ayrıştır
   ```

   IP2Location LITE DB1 (IPv4 tamsayı) CSV de kabul edilir. Tablo boşsa IP ülkesi "bilinmiyor" sayılır (kural eşleşmez).
   Ayda bir güncellemek yeterli. CC BY 4.0 atıf: "IP Geolocation by DB-IP (https://db-ip.com)".
3. İstemci IP'si mevcut `getRequestMeta` (X-Forwarded-For'un ilk değeri) ile alınır; Traefik/Dokploy arkasında bu değerin
   proxy tarafından yazıldığı varsayılır.

## 2. Bekletme (hold) ve serbest bırakma (`src/lib/provisioning/hold.ts`)

Ödeme `fulfillInvoicePayment` → `applyPaidOrderEffects` içinde, yeni hizmet oluşturulmadan hemen önce kontrol edilir
(yenileme / paket değişikliği / mevcut hizmet asla bekletilmez):

- `FRAUD_REVIEW`: siparişin `FraudCheck`'i REVIEW (veya REJECTED);
- `KYC`: ürün kategorisi `kyc_required_categories` içinde (varsayılan `vds,server,datacenter`) ve müşterinin `kycStatus`'u APPROVED değil.

Bekleyen sipariş: ödeme ve fatura tamam (PAID), sipariş `PROCESSING`, `provisioningHeldAt` + `provisioningHoldReasons`
dolu, hizmet ve ProvisioningJob **yok**. `order.paid` olayı yine yayınlanır. KYC nedeniyle bekliyorsa (ve müşteri belge
göndermediyse) `kyc.required` → müşteriye "kimlik doğrulaması gerekiyor" e-postası.

Serbest bırakma (`releaseHeldOrder`): satır kilidi altında nedenler yeniden hesaplanır; hiçbiri kalmadıysa koşullu güncelleme
ile hold bir kez temizlenir, sipariş COMPLETED olur ve normal `prepareOrderProvisioning` çalışır (provisioning.run işi
commit ile kuyruğa girer / manuel ürünlerde MANUAL görev açılır). Tetikleyenler: inceleme onayı, KYC onayı (müşterinin tüm
bekleyen siparişleri). Yönetim panelindeki "Tamamla" düğmesi bekleyen siparişi atlatamaz.

## 3. İnceleme kuyruğu (`/yonetim/siparisler/inceleme`)

Sekmeler: İnceleme bekleyen (REVIEW), Kimlik bekleyen (KYC nedeniyle bekletilen), Karar verilen. Sipariş detayında
"Risk değerlendirmesi" kartı: kural kural puan dökümü, IP/ülke kaynağı, bekletme nedeni ve karar.

- **Onayla** (`orders.manage`): FraudCheck APPROVED, ödeme engeli kalkar, ödenmiş sipariş serbest bırakılır
  (KYC de bekliyorsa onu bekler). `order.review_approved` → müşteriye "siparişiniz onaylandı".
- **Reddet** (`orders.manage`; ödenmişse ayrıca `payments.refund`): ödenmemiş → sipariş + fatura iptal, açık ödeme
  satırları kapatılır; ödenmiş → iade modülü (`createRefund`, karta / bakiyeye / manuel, idempotency `fraud-reject:<orderId>`)
  ve sipariş iptal. İade başarısızsa karar geçerli kalır, mesaj fatura sayfasından manuel iade yapılmasını söyler.
  `order.review_rejected` → müşteriye "siparişiniz onaylanmadı".
- Kararlar `status = REVIEW` koşullu güncellemesiyle alınır: çift tıklama / iki personel tek sonuç üretir.

## 4. Kimlik doğrulama (KYC, `src/lib/kyc/`)

- Durum müşteri başına: `User.kycStatus` NONE → PENDING → APPROVED / REJECTED (+ gönderim/karar zamanı, karar veren, ret nedeni).
- Müşteri sayfası **Panel → Kimlik doğrulama** (`/musteri/panel/kimlik-dogrulama`): neden istendiği (5651), KVKK notu,
  saklama süreleri, bekleyen siparişler. Bireysel: kimlik ön + arka yüz; kurumsal: vergi levhası veya yetkilinin kimliği;
  selfie isteğe bağlı.
- Yükleme `POST /api/kyc/documents` (aynı köken zorunlu, oturum, 10/saat hız sınırı, istek boyutu sınırı): yalnızca JPG/PNG/WEBP/PDF,
  içerik (magic bytes) ile tespit, uzantı içerikle aynı olmalı, dosya başına 8 MB, tür başına tek dosya. Dosyalar depolama
  katmanında (`src/lib/storage`) rastgele `kyc/YYYY/MM/<uuid>` anahtarıyla, herkese kapalı saklanır.
- **Açık rıza**: onay kutusu zorunlu; `ConsentRecord` (belge türü `KYC_CONSENT`, sürüm, metnin SHA-256'sı, IP, tarayıcı)
  belgelerle aynı transaction'da yazılır. Varsayılan metin `src/lib/legal/defaults.ts` (taslak — hukuk kontrolü gerekli).
- Görüntüleme `GET /api/kyc/documents/:id`: yalnızca belgenin sahibi veya **`kyc.review`** yetkili personel (2FA zorunluysa
  2FA'sı olmayan personel müşteri gibi değerlendirilir); başkasına 404. Görseller sandbox'lı CSP ile satır içi, PDF indirme.
  Personelin her görüntülemesi aktivite kaydına (`KYC_DOCUMENT_VIEWED`) yazılır.
- Yönetim: `/yonetim/kyc` (kuyruk) ve `/yonetim/kyc/:userId` (belgeler, hesap bilgileri, bekleyen siparişler, açık rıza kaydı,
  onay/ret). Onay → bekleyen siparişler serbest, `kyc.approved` e-postası. Ret (neden zorunlu, müşteriye iletilir) →
  `kyc.rejected` e-postası, belgelere `deleteAfter = ret + kyc_rejected_retention_days` yazılır; müşteri yeniden yükleyebilir.
- Yetki: `kyc.review` yalnızca ADMIN rolünde (KVKK: en az erişim). Destek ekibine verilecekse `permissions.ts`'te SUPPORT listesine eklenmeli.

### Saklama (retention) kararı

- **Reddedilen belgeler**: ret tarihinden `kyc_rejected_retention_days` (varsayılan 30) gün sonra günlük `kyc-retention`
  cron'u dosyayı depolamadan siler, satır `deletedAt` ile denetim kaydı olarak kalır. İş idempotent (tekrar/üst üste çalışma güvenli).
- **Onaylanan belgeler otomatik silinmez.** Gerekçe: 5651 kapsamında sunucu hizmeti verilen kişinin tespiti hizmet süresince
  gerekir; yer sağlayıcı trafik/kimlik kayıtları için yönetmelikteki saklama (1–2 yıl) ve olası adli talepler hizmet bittikten
  sonra da bir süre saklamayı gerektirir. Öneri: **son sunucu hizmetinin bitişinden itibaren 2 yıl** sonra silme — bu süre
  sahip/hukuk onayı bekliyor; onaylanınca aynı cron'a "APPROVED + son sunucu hizmeti bitişi + N yıl" kuralı eklenebilir.
  O zamana kadar silme talepleri (KVKK m.11) manuel değerlendirilir.

## 5. Olaylar ve şablonlar

| Olay | Abone | Şablon / etki |
|---|---|---|
| `order.review_required` | bildirim, yönetim uyarısı, aktivite | `order.review-pending` ("Siparişiniz inceleniyor"), `admin.event-alert` |
| `order.review_approved` | bildirim | `order.review-approved` |
| `order.review_rejected` | bildirim | `order.review-rejected` (iadenin kendisi ayrıca `refund.completed` ile bildirilir) |
| `kyc.required` | bildirim | `kyc.verification-required` |
| `kyc.submitted` | yönetim uyarısı, aktivite | `admin.event-alert` |
| `kyc.approved` / `kyc.rejected` | bildirim | `kyc.approved` / `kyc.rejected` |

Şablonlar `/yonetim/bildirimler` üzerinden düzenlenebilir (`src/lib/notifications/templates/review.ts`).

## 6. Cron

`kyc-retention` — günlük 03:45 (`scripts/setup-dokploy-schedules.mjs`, `docs/ops-cron.md`).
