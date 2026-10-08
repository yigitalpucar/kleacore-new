# Kuveyt Türk Sanal POS (3D Model)

Birincil kart ödeme sağlayıcısı. Kod: `src/lib/integrations/payment-gateways/providers/kuveytturk*.ts`,
kart formu `src/app/odeme/kuveytturk/`, rotalar `src/app/api/payments/kuveytturk/{start,callback}`.

## Kaynaklar ve doğrulama

Kuveyt Türk'ün entegrasyon PDF'i herkese açık yayımlanmıyor; üye işyerine banka tarafından verilir.
Alan adları, hash bileşimi ve uç noktalar şu kaynaklardan alındı ve **bankanın test ortamında
uçtan uca doğrulandı** (2026-10-08):

| Kaynak | Ne için |
|---|---|
| Banka test ortamı `boatest.kuveytturk.com.tr` (canlı istekler) | ThreeDModelPayGate → BKM 3DS → ACS → OkUrl/FailUrl → ThreeDModelProvisionGate, SaleReversal; gerçek yanıtlar |
| [mewebstudio/pos](https://github.com/mewebstudio/pos) `KuveytPos*` (MIT, bakımlı) | TDV2.0.0 alanları, provizyon/iptal/iade mesajları, SOAP zarfı, yanıt örnekleri, test/canlı URL'leri |
| [emre-tarhan/kuveytturk-vpos-laravel-sdk](https://github.com/emre-tarhan/kuveytturk-vpos-laravel-sdk) | Hash formülleri (ISO-8859-9), yanıt HashData formülü, canlı URL'ler |

Yanıt HashData formülü bankanın gerçek bir yanıtıyla (mewebstudio fixture'ı) ve test ortamındaki
kendi ödememizle doğrulandı (`kuveytturk-protocol.test.ts`).

## Uç noktalar

| | Test | Canlı |
|---|---|---|
| Kart doğrulama | `https://boatest.kuveytturk.com.tr/boa.virtualpos.services/Home/ThreeDModelPayGate` | `https://sanalpos.kuveytturk.com.tr/ServiceGateWay/Home/ThreeDModelPayGate` |
| Provizyon | `…/boa.virtualpos.services/Home/ThreeDModelProvisionGate` | `https://sanalpos.kuveytturk.com.tr/ServiceGateWay/Home/ThreeDModelProvisionGate` |
| İptal/iade (WCF SOAP 1.1) | `https://boatest.kuveytturk.com.tr/BOA.Integration.WCFService/BOA.Integration.VirtualPos/VirtualPosService.svc/Basic` | `https://boa.kuveytturk.com.tr/BOA.Integration.WCFService/BOA.Integration.VirtualPos/VirtualPosService.svc/Basic` |

Test ortamı IP kısıtlaması olmadan erişilebilir. OkUrl/FailUrl'e POST'u **müşterinin tarayıcısı**
yaptığı için `http://localhost` callback'leri de çalışır.

## Akış

1. Sepet / fatura / yenileme → `provider.createCheckout` yeni bir `MerchantOrderId` (`KC…`, 20 karakter)
   üretir, faturaların PENDING `Payment` satırlarına `transactionId` olarak bağlar (`persistGatewayCheckout`)
   ve müşteriyi `/odeme/kuveytturk?ref=<MerchantOrderId>` kart formuna gönderir. Bankaya henüz gidilmez.
2. Kart formu (Luhn, AA/YY, CVV kontrolü, maske) doğrudan `POST /api/payments/kuveytturk/start`'a gönderilir.
   Rota: aynı origin zorunlu (CSRF), oturum + sahiplik, kullanıcı başına 15 dk'da 10 deneme, üretimde HTTPS.
   Tutar istemciden değil `Payment` satırlarından hesaplanır. `KuveytTurkVPosMessage` XML'i
   ThreeDModelPayGate'e gönderilir; dönen kendiliğinden post eden HTML aynen müşteriye döner
   (BKM 3DS sunucusuna → bankanın ACS sayfasına).
3. Banka `AuthenticationResponse` (URL-encode edilmiş XML) alanını OkUrl/FailUrl'e
   (`/api/payments/kuveytturk/callback`, ikisi aynı adres) post eder. Callback:
   - `ResponseCode != "00"` → bekleyen satırlar `FAILED`, banka mesajı Türkçe olarak `gatewayData.errorMessage`'a;
   - HashData doğrulanır (aşağıda); bozuksa **hiçbir şey değişmez**;
   - `VPosMessage.Amount` + para birimi `verifyGatewayAmount` ile oturum tutarına karşı kontrol edilir;
   - satırlar koşullu `updateMany` ile `PROVISIONING` olarak **talep edilir** (yalnızca `PENDING` ve
     `gatewayData IS NULL`) — eşzamanlı/tekrarlanan callback'ler ikinci kez provizyon (çekim) alamaz;
   - ThreeDModelProvisionGate `MD` ile çağrılır; `ResponseCode "00"`, `MerchantOrderId` ve tutar kontrol edilir;
   - banka referansları (`OrderId`, `ProvisionNumber`, `RRN`, `Stan`, kartın son 4 hanesi) `Payment.gatewayData`'ya
     yazılır, sonra mevcut `fulfillGatewayReference` → `fulfillInvoicePayment` (idempotent) çalışır.
4. Sonuç sayfaları: sepet → `/sepet/basarili?session_id=…` / `/sepet/iptal?…&ref=…` (banka mesajı gösterilir),
   fatura → `/musteri/panel/faturalar/<id>?payment=success|failed|review`, yenileme → `/musteri/panel/hizmetlerim?renewal=…`.

## Mesajlar ve hash

`HashedPassword = base64(sha1(Password))`; tüm hash'ler ISO-8859-9 baytları üzerinden `base64(sha1(…))`.

| Mesaj | HashData |
|---|---|
| ThreeDModelPayGate | `MerchantId + MerchantOrderId + Amount + OkUrl + FailUrl + UserName + HashedPassword` |
| ThreeDModelProvisionGate | `MerchantId + MerchantOrderId + Amount + UserName + HashedPassword` |
| SaleReversal / DrawBack / PartialDrawback (`VPosMessage.HashData`) | `MerchantId + MerchantOrderId + Amount + UserName + HashedPassword` |
| AuthenticationResponse (bankadan, başarılıysa) | `MerchantOrderId + ResponseCode + OrderId + HashedPassword` |

- `APIVersion = TDV2.0.0` (3D Secure 2: `DeviceData`, `CardHolderData` zorunlu).
- `Amount` ve `DisplayAmount` kuruş cinsinden tam sayı (120,50 TL → `12050`); `CurrencyCode = 0949`.
- `TransactionType = Sale`, `TransactionSecurity = 3`, `InstallmentCount = 0`.
- `CardHolderData.BillAddrCountry = 792`; `BillAddrState = 34` ve posta kodu `34000` sabit (il kodu müşteri
  kaydında yok; test ortamı kabul ediyor — canlıda banka itiraz ederse müşteri adresinden türetilmeli).
- Başarısız AuthenticationResponse'larda HashData yoktur; bu durumda yalnızca bekleyen deneme kapatılır
  (para hareketi yok). `MerchantOrderId` tahmin edilemez (zaman + 40 bit rastgele).
- Provizyon yanıtı sunucudan sunucuya TLS ile alınır; yanıttaki HashData doğrulanmıyor (formül belgelenmemiş).

## Taksit

Şimdilik **yalnızca tek çekim** (`InstallmentCount = 0`). Taksit eklemek için: kart BIN'ine göre taksit
seçenekleri, vade farkının müşteriye yansıtılması (`Amount` değişir → `verifyGatewayAmount`'ta
`paidAmount > requestedAmount` yolu) ve ön bilgilendirme metni gerekir.

## İptal / iade

`cancelKuveytTurkPayment` (SaleReversal — gün sonu öncesi tam iptal) ve
`refundKuveytTurkPayment(…, { partial })` (DrawBack tam iade / PartialDrawback kısmi iade) hazır;
iade özelliği bunları `Payment.gatewayData` içindeki `orderId`, `rrn`, `stan`, `provisionNumber`,
`amountKurus` ile çağıracak. Test ortamında doğrulandı: SaleReversal → `00 OTORİZASYON VERİLDİ`;
tekrar → `İşlem daha önce iptal edilmiştir.`; iptal edilmiş işleme PartialDrawback → `28 İptal Edilen İşlem İade Yapılamaz`.
DrawBack aynı gün denenemedi (gün sonu kapanmadan iade yapılamaz) — ilk canlı iadede doğrulanmalı.

## Kart verisi (PCI)

- Kart numarası/CVV/SKT yalnızca start isteğinin belleğinde yaşar; DB'ye, oturuma, tarayıcı depolamasına,
  URL'ye yazılmaz. Hata mesajları yalnızca kendi kodlarımızı içerir (`KUVEYTTURK_HTTP_500` vb.).
- `src/lib/logger.ts` kart/şifre/CVV/HashData/MD anahtarlarını `[REDACTED]` yapar, Luhn-geçerli 12-19 haneli
  sayıları `[KART ****1234]` olarak maskeler.
- `gatewayData`'da yalnızca son 4 hane tutulur.
- Kart formu sitemizde açıldığı için (3D Model) üye işyeri PCI DSS SAQ A-EP kapsamındadır; bankanın ortak
  ödeme sayfası (3D Pay Hosting) kullanılırsa SAQ A'ya inilebilir — sahibin kararı.

## Yapılandırma

Yönetim → Entegrasyonlar → Ödeme → "Kuveyt Türk Sanal POS": üye işyeri no (MerchantId), müşteri no
(CustomerId), API kullanıcı adı, API şifresi (`kuveytturk_password`, `ENCRYPTION_KEY` ile şifreli saklanır),
ortam (test/canlı), "Aktif sağlayıcı = Kuveyt Türk". Ortam değişkenleri: `KUVEYTTURK_*` (`.env.example`).
Kuveyt Türk kurumsal panelinde OkUrl/FailUrl için `https://kleacore.com/api/payments/kuveytturk/callback`
tanımlanmalı (bankanın istemesi halinde).

Herkese açık test hesabı (yalnızca test ortamı): MerchantId `496`, CustomerId `400235`, kullanıcı `apitest`,
şifre `api123`. Test kartı: `5188 9619 3919 2544`, SKT `06/29`, CVV `588`, 3D doğrulama kodu `123456`.

## Canlıya geçmeden önce

- [ ] Bankadan gerçek MerchantId/CustomerId/API kullanıcısı; API kullanıcısının "Sanal POS API" yetkisi.
- [ ] Canlıda küçük tutarlı gerçek ödeme + aynı gün SaleReversal.
- [ ] Ertesi gün bir test ödemesine DrawBack ve PartialDrawback.
- [ ] `BillAddrState`/posta kodu sabitlerinin canlıda kabul edildiği.
- [ ] Callback'in 3DS sunucusu domain'inden geldiği haliyle CSP report-only loglarında ihlal üretmediği
      (`form-action` listesine `*.kuveytturk.com.tr`, `*.bkm.com.tr`, `*.bkmtest.com.tr` eklendi).
- [ ] `PROVISION_UNKNOWN` / `FULFILLMENT_ERROR` loglarına alarm (kart çekildi ama fatura kapanmadı).
