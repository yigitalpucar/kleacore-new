# Kayıtlı kart + otomatik tahsilat (Faz 3.7)

Müşteri kartını bir kez 3D Secure ile kaydeder. Kart **ödeme kuruluşunda** saklanır. Sonraki ödemeler
("Kayıtlı kartla öde" ve vadesi gelen faturaların otomatik tahsilatı) 3D olmadan, kart bilgisi
girilmeden yapılır. KLEACORE kart numarasını (PAN) ve CVV'yi **hiçbir zaman** görmez ve saklamaz.
Elimizde yalnızca ödeme kuruluşunun token'ları (şifreli) ve maskeli bilgi kalır: son 4 hane, şema,
banka, SKT ay/yıl.

## 1. Araştırma: hangi sağlayıcı ne sunuyor?

| | Kuveyt Türk VPOS (birincil) | PayTR (Kart Saklama API) | iyzico (Card Storage) |
|---|---|---|---|
| Kart saklama / token | **Yok** (herkese açık belgede yok) | **Var**: `store_card=1` → `utoken` (kullanıcı) + `ctoken` (kart) | **Var**: `cardUserKey` + `cardToken` |
| Token ile 3D'siz (MIT) çekim | — | **Var**: `non_3d=1` + `recurring_payment=1`, eşzamanlı JSON yanıt | **Var**: `POST /payment/auth`, `paymentCard{cardUserKey, cardToken}` |
| İlk kayıtta kart verisi nereye gidiyor? | — | Tarayıcı formu **doğrudan paytr.com'a** post eder (bizim sunucumuza gelmez) | Kart verisi **bizim sunucumuzdan** iyzico API'sine gider (`/cardstorage/card` veya `registerCard=1`); Checkout Form kart saklamayı desteklemiyor |
| Kart listesi / silme | — | `capi/list`, `capi/delete` | `/cardstorage/cards`, `DELETE /cardstorage/card` |
| Ön koşul | — | PayTR'den **Non3D** ve kart saklama yetkisi istenmeli | Mağazada kart saklama açık olmalı |

### Kuveyt Türk

- Herkese açık Kuveyt Türk dokümanı yok (entegrasyon PDF'i üye işyerine veriliyor). Bakımlı açık kaynak
  istemci [mewebstudio/pos](https://github.com/mewebstudio/pos) Kuveyt Türk için yalnızca **NonSecure** ve
  **3DSecure** ödeme modellerini, iptal/iade/sorgu işlemlerini listeliyor; tekrarlı ödeme veya kart saklama yok.
- **Test ortamında denendi (2026-10-08):** `boatest.kuveytturk.com.tr/.../Home/Non3DPayGate`,
  `TransactionSecurity=1`, herkese açık test hesabı (496/apitest) ve test kartıyla 1,00 TL satış →
  `00 OTORİZASYON VERİLDİ`. Yani 3D'siz provizyon **teknik olarak var**, ama **her seferinde kart numarası +
  SKT + CVV gönderilmesini** istiyor. Bunu otomatik tahsilatta kullanmak kart numarasını bizim saklamamızı
  gerektirir. Bu yasak (PCI DSS SAQ D kapsamı, CVV saklamak hiçbir koşulda serbest değil), o yüzden bu yol kapalı.
- Yanıt sözleşmesinde `TokenInfoId` ve `IsTemporaryCard` alanları var (değerleri `nil`). Bankanın
  belgelenmemiş bir token/kart saklama özelliği olabilir. **Sahip bankaya sormalı:** "Sanal POS'ta kart
  saklama (tokenization) ve token ile 3D'siz tekrarlı tahsilat var mı?" Varsa ileride Kuveyt Türk'e taşınabilir.
  Altyapı ağ geçidinden bağımsız (`SavedCard.gateway`).

### PayTR

Kaynaklar: [Kart Saklama API](https://dev.paytr.com/en/direkt-api/kart-saklama-api) ·
[Yeni kart ekleme](https://dev.paytr.com/en/direkt-api/kart-saklama-api/yeni-kart-ekleme) ·
[Kayıtlı kart listesi](https://dev.paytr.com/en/direkt-api/kart-saklama-api/kayitli-kart-listesi) ·
[Kayıtlı kart silme](https://dev.paytr.com/en/direkt-api/kart-saklama-api/kayitli-kart-silme) ·
[Kayıtlı karttan ödeme](https://dev.paytr.com/en/direkt-api/kart-saklama-api/kayitli-karttan-odeme) ·
[Tekrarlayan ödeme](https://dev.paytr.com/en/direkt-api/kart-saklama-api/kayitli-kart-tekrarlayan-odeme) ·
[Direkt API 1. adım](https://dev.paytr.com/en/direkt-api/direkt-api-1-adim) ·
[Direkt API 2. adım (bildirim)](https://dev.paytr.com/en/direkt-api/direkt-api-2-adim)

| İşlem | Uç nokta | `paytr_token` = base64(HMAC-SHA256(merchant_key, …)) |
|---|---|---|
| Kart ekleme (3D, `store_card=1`, kullanıcının mevcut `utoken`'ı varsa o da gönderilir) | `POST https://www.paytr.com/odeme` (tarayıcıdan) | `merchant_id + user_ip + merchant_oid + email + payment_amount + payment_type + installment_count + currency + test_mode + non_3d + salt` |
| Kart listesi | `POST /odeme/capi/list` | `utoken + salt` |
| Kart silme | `POST /odeme/capi/delete` | `ctoken + utoken + salt` |
| Tekrarlayan çekim (`non_3d=1`, `recurring_payment=1`, `utoken`, `ctoken`) | `POST /odeme` (sunucudan) | kart eklemedeki formülle aynı |

Liste yanıtı kart başına `ctoken, last_4, month, year, c_bank, c_name, c_brand, c_type, schema, initial,
require_cvv, businessCard` döner. `require_cvv=1` olan kart CVV'siz çekilemez, bu yüzden otomatik ödemede
kullanılmaz. Tekrarlayan çekim yanıtı `status = success | failed | wait_callback`, `msg` ve `try_again`
alanlarını içerir. Kesin sonucu her durumda bildirim (callback) URL'i alır.

### iyzico

Kaynak: [Card Storage](https://docs.iyzico.com/en/advanced/card-storage),
[Checkout Form initialize](https://docs.iyzico.com/en/payment-methods/direct-charge/checkoutform/cf-implementation/cf-initialize).
Token ile 3D'siz çekim mümkün. Ancak kartı kaydetmek için kart numarasının **bizim sunucumuzdan** iyzico
API'sine gönderilmesi gerekiyor, çünkü Checkout Form kart saklamayı desteklemiyor. Bu da kart verisini
sunucumuzdan geçirir ve PCI kapsamını SAQ D'ye yükseltir.

## 2. Seçilen yol ve sahibin bilmesi gereken bedel

**Kayıtlı kart ağ geçidi: PayTR. Tek seferlik ödemelerde varsayılan yine Kuveyt Türk.**

- Kuveyt Türk token sunmadığı için kayıtlı kartla yapılan **bütün** çekimler PayTR'den geçer: hem "Kayıtlı
  kartla öde" hem de otomatik tahsilat. Normal kart ödemesi (form + 3D) Kuveyt Türk'te kalır.
- **Komisyon:** kayıtlı karttan çekilen tutarlara PayTR komisyonu uygulanır. Kuveyt Türk VPOS oranından
  genelde yüksektir; sözleşmenize bakın. Para PayTR hesabına düşer ve PayTR'nin ödeme takvimiyle aktarılır.
- **Doğrulama çekimi:** kart eklenirken PayTR'nin kart saklama akışı bir ödeme ister. 1,00 TL 3D'li satış
  yapılır, kart kaydedildikten hemen sonra PayTR iade API'siyle iade edilir. İade başarısız olursa
  Yönetim → Faturalar → Otomatik tahsilat sayfası uyarır ve PayTR panelinden elle iade gerekir.
- **PCI:** kart formu sayfamızda açılır ama doğrudan paytr.com'a post eder (Kuveyt Türk formundaki gibi
  SAQ A-EP). PAN ve CVV sunucumuza hiç gelmez. iyzico yolu bunu SAQ D'ye çıkarırdı; bu, iyzico'nun
  seçilmemesinin ana nedeni.
- **PayTR'den istenecekler:** mağazada **Non3D** yetkisi ve kart saklama (CAPI) / tekrarlayan ödeme yetkisi.
  Bu yetkiler olmadan tekrarlayan çekim reddedilir.
- **Hukuki:** otomatik tahsilat için açık onay alınır ve kaydedilir (metin, zaman, IP, tarayıcı). Bkz. §4.

## 3. Veri modeli (migration `20261012170000_saved_cards`)

- `SavedCard`: `userId, gateway ("paytr"), gatewayCustomerRef (utoken, şifreli), cardToken (ctoken, şifreli),
  last4, brand, cardProgram, expMonth, expYear, bankName, requireCvv, isDefault, status
  (PENDING/ACTIVE/EXPIRED/FAILED/DELETED), consentAt, consentIp, consentUserAgent, consentText,
  verificationRef (1 TL siparişinin merchant_oid'i), verificationRefundedAt, failureReason,
  verificationChargedAt, expiryNoticeSentAt, deletedAt`. Kullanıcı başına tek varsayılan kart kuralını
  uygulama koruyor (`setDefaultSavedCard` transaction'ı). Prisma kısmi index'i şemada ifade edemediği ve
  sonraki `migrate dev` onu silmeye çalıştığı için DB'ye kısmi index eklenmedi.
- `PaymentAttempt`: kayıtlı karttan yapılan her çekim. `idempotencyKey` unique: otomatikte
  `auto:<invoiceId>:<YYYY-MM-DD>` (Europe/Istanbul), elle ödemede `manual:<invoiceId>:<uuid>`.
  `gatewayRef` unique (= PayTR `merchant_oid` = `Payment.transactionId`). `kind` AUTO/MANUAL, `status`
  PENDING/SUCCEEDED/FAILED/UNKNOWN.
- `User.autoPayEnabled`, `autoPayConsentAt`, `autoPayConsentIp`: otomatik ödeme müşteri bazında açılır.
- Token'lar `ENCRYPTION_KEY` ile `enc:v1:` (AES-256-GCM) olarak saklanır. Silinen kartta token'lar boşaltılır.
  Logger `utoken/ctoken/cardToken/cardUserKey/gatewayCustomerRef` anahtarlarını `[REDACTED]` yapar.

## 4. Akışlar

**Kart ekle** (`/musteri/panel/kayitli-kartlar`)
1. Müşteri onay metnini işaretler (`SAVED_CARD_CONSENT_TEXT`; onaysız kart eklenemez). `PENDING` kart ve
   `KV…` sipariş numarası oluşur. Saatte en fazla 5 deneme, en fazla 5 aktif kart.
2. `/kayitli-kartlar/ekle?ref=KV…`: imzalı gizli alanlar (`store_card=1`, `payment_amount=1.00`, varsa
   mevcut `utoken`) ve kart alanları doğrudan `https://www.paytr.com/odeme`'ye post edilir (CSP
   `form-action` zaten paytr.com'u içeriyor). Ardından 3D açılır.
3. PayTR bildirimi (`/api/payments/paytr/callback`, hash doğrulanır) `KV…` siparişini tanır.
   `utoken` ile `capi/list` çağrılır, yeni `ctoken` bulunur, kart `ACTIVE` olur (ilk kartsa varsayılan)
   ve 1 TL iade edilir. Bildirim tekrar gelirse hiçbir şey değişmez.

**Varsayılan / sil:** silme önce PayTR'de yapılır (`capi/delete`). PayTR onaylamazsa kart bizde de kalır.
Varsayılan kart silinirse en yeni aktif kart varsayılan olur. Hiç kart kalmazsa otomatik ödeme kapanır.

**Kayıtlı kartla öde** (fatura detay sayfası): onay penceresi → `payInvoiceWithSavedCard` (15 dakikada
5 deneme) → `chargeInvoiceWithSavedCard`.

**`chargeInvoiceWithSavedCard`** (elle ve otomatik ödemede ortak)
1. Fatura satırı kilitlenir (`SELECT … FOR UPDATE`). Durum PENDING/OVERDUE olmalı. **Tutar faturadan
   hesaplanır** (`total − paid`), çağırandan alınmaz. Sonucu belli olmayan (PENDING/UNKNOWN) bir deneme
   varsa yeni çekim yapılmaz.
2. Aynı transaction'da `PaymentAttempt` (unique anahtar) ve tam bu tutarla `PENDING` `Payment`
   (`transactionId = merchant_oid`) yazılır.
3. PayTR'ye `non_3d=1, recurring_payment=1` ile istek gider:
   - `success` → `fulfillGatewayReference` → `fulfillInvoicePayment`, yani normal ödeme yolu (provizyon,
     e-fatura, "ödeme alındı" bildirimi). Aynı sipariş için gelen PayTR bildirimi idempotent olarak bir şey
     değiştirmez.
   - `failed` → Payment `FAILED`, attempt `FAILED`.
   - `wait_callback`, `try_again` ya da okunamayan yanıt → attempt `UNKNOWN`. Kesin sonucu PayTR bildirimi
     verir (`settleStoredChargeNotification`). Bildirim başarısızsa müşteri bilgilendirilir.

**Günlük iş** `auto-charge` (`/api/cron/auto-charge`, Dokploy `30 5 * * *`: 05:00'teki gecikme
işaretlemesinden sonra, 06:00'daki askıya almadan önce; advisory lock + `CronRun`, günde bir kez):
- Önce kart süreleri kontrol edilir. Süresi 30 gün içinde dolacak karta bir kez `billing.card-expiring`
  gönderilir. Süresi dolan kart `EXPIRED` olur ve varsayılansa sıradaki kart varsayılan yapılır.
- Sonra otomatik ödemesi açık müşterilerin `PENDING/OVERDUE` faturaları işlenir. Koşullar:
  `dueDate ∈ [bugün − auto_charge_grace_days, bugün sonu]` ve bekleyen havale bildirimi olmaması.
  Fatura başına günde bir deneme yapılır, toplam en fazla `auto_charge_max_attempts` (varsayılan 3) deneme.
  Varsayılan kart kullanılır.
- Başarısız çekimde `emitEvent(tx, "payment.failed", …)` çalışır ve `billing.auto-charge-failed`
  ("Kartınızdan tahsilat yapılamadı") e-postası/SMS'i gider. Dedupe anahtarı deneme başınadır.
- **Not:** `src/lib/events/emit.ts` bu dalda **stub** (no-op). Gerçek outbox f3/events dalından gelecek.

**Ayarlar:** Yönetim → Faturalar → Otomatik tahsilat (`saved_cards_enabled`, `auto_charge_max_attempts`,
`auto_charge_grace_days`; ortam değişkenleri `SAVED_CARDS_ENABLED`, `AUTO_CHARGE_MAX_ATTEMPTS`,
`AUTO_CHARGE_GRACE_DAYS`). Aynı sayfada son 30 günün denemeleri ve iadesi yapılamamış doğrulama
çekimleri görünür. PayTR mağaza bilgileri Entegrasyonlar → Ödeme'den gelir. PayTR'nin ödeme yöntemi
olarak açık olması gerekmez; tek seferlik ödemelerde Kuveyt Türk varsayılan kalabilir.

## 5. Testler

- `src/lib/payments/saved-cards.test.ts` (sahte DB + sözleşme düzeyinde sahte PayTR; her `paytr_token`
  PayTR'nin formülüyle doğrulanır):
  - onaysız kart eklenemez ve otomatik ödeme açılamaz; onay metni, zaman ve IP kaydedilir;
  - kart formu kart verisi içermez; DB'de token'lar yalnızca şifreli durur; 1 TL iade edilir; tekrarlanan
    bildirim etkisizdir;
  - token'lar hiçbir log satırına, bildirime, olaya veya ödeme notuna düşmez (hata yolları dahil);
  - silme PayTR'ye doğru token ve hash ile gider, PayTR reddederse kart kalır, varsayılan devredilir,
    son kartla birlikte otomatik ödeme kapanır, başka müşterinin kartı silinemez;
  - aynı gün iki çalıştırma tek çekim yapar (başarılı ve başarısız çekimde ayrı ayrı test edildi);
  - başarısızlık sayımı: günde bir deneme, bildirimler 1/3, 2/3, 3/3, dördüncü gün çekim yok;
  - tutar faturadan hesaplanır (kısmi ödenmiş faturada kalan tutar çekilir);
  - `wait_callback` sonrası yeni çekim yapılmaz;
  - kart süresi bildirimi tek sefer gider, süresi dolan kart emekliye ayrılır.
- `providers/paytr-card-storage.test.ts`: hash formülleri, liste/silme/çekim yanıtlarının eşlenmesi.
- `saved-cards.integration.test.ts` (`RUN_DB_TESTS=1`, gerçek Postgres, gerçek callback route'u ve gerçek
  fulfilment): kart kaydı → otomatik ödeme → fatura **PAID**. Ardından gelen PayTR bildirimi bir şey
  değiştirmez.

PayTR'nin herkese açık bir test üye işyeri yok (test modu gerçek mağaza bilgileriyle çalışır). Bu yüzden
uçtan uca test sözleşme düzeyinde sahte bir PayTR'ye karşı yapıldı.

## 6. Gerçek PayTR bilgileriyle doğrulanacaklar (`PAYTR_TEST_MODE=1`)

- [ ] PayTR panelinde Non3D + kart saklama/tekrarlayan ödeme yetkisinin açık olduğu.
- [ ] Kart ekleme formunun (`store_card=1`) 3D'ye gittiği ve OK URL'ine döndüğü. `expiry_year`'ın 2 hane
      (YY) kabul edildiği.
- [ ] Bildirimde `utoken`'ın gerçekten geldiği ve alan adının `utoken` olduğu (gelmezse kod, kullanıcının
      mevcut utoken'ıyla devam eder; ilk kartta kart FAILED olur).
- [ ] Direct API bildiriminde `total_amount`'un kuruş mu (`100`) yoksa TL mi (`1.00`) geldiği (ikisi de
      kabul ediliyor, sadece doğrulama logu etkileniyor).
- [ ] `capi/list` yanıtının JSON dizi olduğu ve yeni kartın listede yer aldığı. Aynı kart ikinci kez
      eklendiğinde PayTR'nin ne yaptığı (kod bunu "kart bulunamadı" sayıp 1 TL'yi iade ediyor).
- [ ] 1 TL doğrulama çekiminin iade API'siyle aynı gün iade edilebildiği.
- [ ] `non_3d=1, recurring_payment=1` çekimin eşzamanlı `{"status":"success"}` döndüğü ve aynı
      `merchant_oid` için bildirim de geldiği. Faturanın tek sefer kapandığı.
- [ ] `non3d_test_failed=1` ile başarısız çekim: müşteri e-postası, `PaymentAttempt FAILED`.
- [ ] `capi/delete` sonrası `capi/list`'te kartın görünmediği. Silinmiş kartla çekimin reddedildiği.
- [ ] `require_cvv=1` dönen bir kartta otomatik ödemenin açılamadığı.
- [ ] Canlıda üye işyeri komisyonunun ve hesaba geçiş süresinin sözleşmeye uygun olduğu.

## 7. Açık konular

- Sepet (checkout) adımında "kayıtlı kartla öde" yok. Sipariş faturası panelden kayıtlı kartla
  ödenebiliyor, vadesi geldiyse otomatik tahsil ediliyor. Sepete eklemek `checkoutCart`'ta çok faturalı
  çekim gerektiriyor (bir sonraki adım).
- `UNKNOWN` kalan bir deneme (bildirimi hiç gelmeyen çekim) o faturanın sonraki çekimlerini bloke eder.
  Yönetici PayTR panelinden kontrol edip faturayı elle kapatmalı. Bu, kör yeniden çekime tercih edildi.
- Kuveyt Türk kart saklama sunarsa: yeni bir sağlayıcı adaptörü (`gateway = "kuveytturk"`) eklenir.
  Model ve iş akışı değişmez.
