# E-Fatura / e-Arşiv — Uyumsoft entegrasyonu

Ödenen her KLEACORE faturası için resmi e-belge keser. Varsayılan sağlayıcı **Uyumsoft**; Paraşüt isteğe bağlı kalır.

## Akış

1. Ödeme tamamlanınca `fulfillInvoicePayment` → `queueEInvoiceDraft(invoiceId)` (geriye uyumlu ad) → `issueEInvoiceForInvoice(invoiceId)`.
   İş kuyruğu (pg-boss) gelince kuyruk doğrudan `issueEInvoiceForInvoice` çağırmalı; fonksiyon idempotent.
2. Fatura başına tek `EInvoiceRecord` (unique `invoiceId`). ETTN (`documentUuid`) kayıt oluşurken üretilir ve yeniden denemelerde **değişmez**.
   Her deneme kaydı atomik olarak "claim" eder (`lastAttemptAt` + `attempts`); 2 dk içinde ikinci bir işçi aynı kaydı göndermez.
3. Müşterinin `taxNumber`'ı 10 hane → VKN, 11 hane → TCKN. Numara varsa `IsEInvoiceUser` sorulur:
   mükellefse **e-Fatura** (`GetUserAliasses` ile `urn:mail:` posta kutusu etiketi, profil: ayarlardaki TEMELFATURA/TICARIFATURA),
   değilse veya numara yoksa **e-Arşiv** (numarasız bireysel müşteri: `11111111111`).
4. Tutarlar: fatura başlığı (`subtotal`, `taxAmount`, `totalAmount`) esas alınır, kuruşa (tam sayı) çevrilir ve kalemlere en büyük kalan yöntemiyle dağıtılır.
   Kalem toplamları başlıkla kuruşu kuruşuna aynıdır. `subtotal + KDV ≠ toplam` ya da KDV oranla tutmuyorsa belge **gönderilmez**, kayıt `FAILED` olur ve hata yönetimde görünür.
   (Kalemlerdeki `totalPrice` bazı akışlarda KDV dahil, bazılarında hariç; bu yüzden yalnızca dağıtım ağırlığı olarak kullanılır.)
5. Uyumsoft `SendInvoice` → numara (`BOX2026000001884` gibi) ve durum `SENT` kaydedilir; UBL XML `ublPayload.xml`'de saklanır.
6. Durum takibi: `syncEInvoiceStatuses({ limit })` `SENT` kayıtları toplu `QueryOutboxInvoiceStatus` ile sorgular. Cron/kuyruk dostu;
   15 dakikada bir `/api/cron/efatura-status` (advisory lock + `cron_runs`, bkz. `docs/ops-cron.md`) çalıştırır; `/yonetim/efatura` → "Durumları güncelle" elle tetikler.
7. PDF: `GET /api/faturalar/[id]/e-belge` (müşteri kendi faturası / admin) entegratörden canlı çeker. Müşteri fatura sayfasında "Resmi faturayı indir".
8. e-Arşiv iptali: admin listesinde iptal (neden zorunlu, yerelde `cancelReason`). Uyumsoft yalnızca işlenmiş (`Approved`) belgeyi iptal eder.

Durum eşlemesi (Uyumsoft `InvoiceStatus` → `EInvoiceStatus`): Draft/NotSend/NotPrepared → QUEUED · Queued/Processing/SentToGib/WaitingForAprovement → SENT ·
Approved → ACCEPTED · Declined/Return → REJECTED · Canceled/EArchivedCanceled → CANCELLED · Error → FAILED.

## Ayarlar (`/yonetim/entegrasyonlar?tab=efatura`)

| Anahtar | Not |
|---|---|
| `efatura_enabled`, `efatura_provider` (`uyumsoft` \| `parasut`) | |
| `efatura_company_vkn`, `efatura_company_*` | Satıcı (AccountingSupplierParty). Boşsa `company_name`, `company_email`, `company_phone`, `company_address`, `site_url` kullanılır. |
| `efatura_uyumsoft_username`, `efatura_uyumsoft_password` | Şifre AES-256-GCM ile şifreli (`SECRET_SETTING_KEYS`). |
| `efatura_uyumsoft_test_mode` | Varsayılan **açık** (test ortamı). |
| `efatura_uyumsoft_earsiv_prefix`, `efatura_uyumsoft_efatura_prefix` | Boş: numarayı Uyumsoft portalındaki varsayılan seri verir (önerilen). Dolu (3 karakter): KLEACORE `SSSYYYY000000001` biçiminde sırayla üretir; `documentNumber` unique. |
| `efatura_default_profile` | e-Fatura için TEMELFATURA / TICARIFATURA. |

## Uyumsoft servisi

- WSDL: `https://efatura-test.uyumsoft.com.tr/Services/Integration?wsdl` (test), `https://efatura.uyumsoft.com.tr/Services/Integration` (canlı). 08.10.2026'da ikisi de erişilebilir, 64 operasyon.
- WCF BasicHttpBinding, HTTPS + WS-Security `UsernameToken` (PasswordText) + `Timestamp`. SOAPAction: `"http://tempuri.org/IIntegration/<Op>"`.
- Kütüphane: SOAP framework yok; `fetch` + elle kurulan zarf (`providers/uyumsoft/soap.ts`), yanıt `fast-xml-parser` ile ayrıştırılıyor.
- Test kullanıcısı: Uyumsoft'un herkese açık `Uyumsoft` / `Uyumsoft` (test hesabının VKN'si 9000068418). Belgede satıcı VKN'si hesabın VKN'si olmalı.
- Hata biçimleri: yetki hatası HTTP 500 + SOAP Fault (`Bu sisteme erişmek için gerekli yetkiniz yok…`); iş hatası `IsSucceded="false" Message="…"`.
  `FlagResponse` dönen çağrılarda (`IsEInvoiceUser`, `CancelEArchiveInvoice`) asıl cevap `Value`'dadır — `IsSucceded="true" Value="false"` iptalin reddedildiği anlamına gelir.

Kullanılan operasyonlar: `WhoAmI` (bağlantı testi), `IsEInvoiceUser`, `GetUserAliasses`, `SendInvoice`, `QueryOutboxInvoiceStatus`, `GetOutboxInvoicePdf`, `CancelEArchiveInvoice`.

### Kayıtlı istek/yanıt örnekleri (test ortamı, kimlik bilgileri gizli)

Fixture'lar: `src/lib/integrations/efatura/providers/uyumsoft/__fixtures__/`. Tekrar üretmek için:
`pnpm exec tsx scripts/efatura-uyumsoft-smoke.ts --cancel --log /tmp/uyumsoft.log --pdf /tmp/e-arsiv.pdf`

```xml
<!-- İstek zarfı -->
<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/"><s:Header>
  <wsse:Security s:mustUnderstand="1" xmlns:wsse="…wssecurity-secext-1.0.xsd" xmlns:wsu="…wssecurity-utility-1.0.xsd">
    <wsu:Timestamp wsu:Id="TS-1"><wsu:Created>2026-10-08T14:07:40.728Z</wsu:Created><wsu:Expires>2026-10-08T14:12:40.728Z</wsu:Expires></wsu:Timestamp>
    <wsse:UsernameToken wsu:Id="UT-1"><wsse:Username>***</wsse:Username><wsse:Password Type="…#PasswordText">***</wsse:Password></wsse:UsernameToken>
  </wsse:Security></s:Header>
  <s:Body>…</s:Body></s:Envelope>

<!-- SendInvoice gövdesi (e-Arşiv, kısaltılmış) -->
<SendInvoice xmlns="http://tempuri.org/"><invoices><InvoiceInfo LocalDocumentId="<KLEACORE invoice id>">
  <Invoice xmlns:cac="…CommonAggregateComponents-2" xmlns:cbc="…CommonBasicComponents-2">
    <cbc:UBLVersionID>2.1</cbc:UBLVersionID><cbc:CustomizationID>TR1.2</cbc:CustomizationID><cbc:ProfileID>EARSIVFATURA</cbc:ProfileID>
    <cbc:ID></cbc:ID><!-- boş: Uyumsoft numara verir -->
    <cbc:UUID>03ad4c0a-…</cbc:UUID><cbc:IssueDate>2026-10-08</cbc:IssueDate><cbc:IssueTime>17:07:40</cbc:IssueTime>
    <cbc:InvoiceTypeCode>SATIS</cbc:InvoiceTypeCode><cbc:Note>KLEACORE fatura no: …</cbc:Note><cbc:Note>Yalnız: …</cbc:Note>
    … AdditionalDocumentReference(SEND_TYPE=ELEKTRONIK), Signature, AccountingSupplierParty, AccountingCustomerParty(TCKN + Person),
    PaymentMeans(48), TaxTotal(KDV 0015, %20), LegalMonetaryTotal, InvoiceLine × n (her kalemde TaxTotal) …
  </Invoice>
  <TargetCustomer VknTckn="11111111111" Title="Test Müşteri"/>
  <EArchiveInvoiceInfo DeliveryType="Electronic"><InternetSalesInfo><WebAddress>https://kleacore.com</WebAddress>
    <PaymentType>KREDIKARTI/BANKAKARTI</PaymentType><PaymentDate>2026-10-08T14:07:40.335Z</PaymentDate></InternetSalesInfo></EArchiveInvoiceInfo>
  <Scenario>eArchive</Scenario>
  <Notification><Mailing EnableNotification="true" To="test@example.com"><Subject>… e-Arşiv faturanız</Subject></Mailing></Notification>
  <CreateDateUtc>2026-10-08T14:07:40.729Z</CreateDateUtc>
</InvoiceInfo></invoices></SendInvoice>
<!-- e-Fatura: TargetCustomer Alias="urn:mail:defaultpk@test.com", Scenario=eInvoice, EArchiveInvoiceInfo/Notification yok -->
```

| Operasyon | Yanıt (Body) |
|---|---|
| `SendInvoice` | `<SendInvoiceResult IsSucceded="true"><Value Id="<ETTN>" Number="BOX2026000001884" InvoiceScenario="eArchive"/></SendInvoiceResult>` |
| `IsEInvoiceUser` | `<IsEInvoiceUserResult IsSucceded="true" Value="true"/>` (9000068418), `Value="false"` (11111111111) |
| `GetUserAliasses` | `<Value><Definition Identifier="9000068418" Title="…"/><ReceiverboxAliases Alias="urn:mail:defaultpk@test.com" Enabled="true"/>…</Value>` |
| `QueryOutboxInvoiceStatus` | `<Value Status="Approved" StatusCode="1000" InvoiceId="…"/><Value Status="EArchivedCanceled" StatusCode="1400" InvoiceId="…"/>` (bilinmeyen ETTN sessizce atlanır) |
| `GetOutboxInvoicePdf` | `<Value LocalDocumentId="…" InvoiceId="…"><Data>base64 PDF (~185 KB)</Data></Value>` |
| `CancelEArchiveInvoice` | `IsSucceded="true" Message="Fatura iptal edildi" Value="true"`; kuyruktaki belge için `Value="false" Message="Faturanın durumu iptal edilmeye uygun değil. Durum: Kuyrukta."` |

## 08.10.2026 test ortamı doğrulaması

- `WhoAmI`, `IsEInvoiceUser` (true/false), `GetUserAliasses` ✔
- e-Arşiv: 2 kalemli örnek (249,99 + %20 KDV = 299,99) gönderildi → `BOX2026000001887/88`, birkaç saniyede `Queued` → `Approved`, PDF indirildi ve kontrol edildi (tutarlar, KDV, notlar, internet satış bilgisi doğru), ardından iptal → `EArchivedCanceled` ✔
- Yerel veritabanı üzerinden uçtan uca: ödenmiş iki fatura `issueEInvoiceForInvoice` ile kesildi (`BOX2026000001889/90`), ikinci çağrı aynı kaydı döndürdü (idempotent), `syncEInvoiceStatuses` → `ACCEPTED`, `getEInvoicePdf` ✔
- e-Fatura: VKN 9000068418'li kurumsal müşteriye TEMELFATURA, yerel seri `KLE` ile `KLE2026000000001` → `SentToGib` ✔

## Doğrulanmamış / canlıya geçmeden

- **Seri öneki:** Uyumsoft, `cbc:ID` boşken portalda tanımlı varsayılan seriden numara veriyor; API ile seri seçmenin yolu bulunamadı (`ID="KLE"` ve `ExtraInformation` yok sayıldı).
  Canlıda önce Uyumsoft portalında KLEACORE serisini varsayılan yapın ve önek alanlarını boş bırakın. Önek doldurulursa numaralar KLEACORE'da üretilir; aynı seriyle portaldan elle belge kesilirse çakışma olur.
- Test ortamı geçersiz numaraları (ör. `KLE2026`) da kabul ediyor; canlı GİB kuralları daha sıkı. İlk canlı belgeyi tek bir faturayla deneyin.
- e-Fatura için kabul/red (`TICARIFATURA`) yanıtları ve `Declined/Return` durumları test ortamında gözlenmedi; eşleme WSDL enum'una göre.
- Kalem KDV'leri başlıktaki KDV'ye eşitlenecek şekilde dağıtılıyor; çok kalemli faturalarda bir kalemin KDV'si kendi matrahının %20'sinden 1 kuruş sapabilir (toplamlar her zaman tam).
  Uyumsoft testte sorun çıkarmadı.
- Müşteride ilçe alanı yok; UBL `CitySubdivisionName` için "Merkez", şehir boşsa "İstanbul" yazılıyor.
- Paraşüt sağlayıcısı yeni arayüze uyarlandı (`checkTaxpayer` = `e_invoice_inboxes`), durum/PDF/iptal Paraşüt panelinden yapılır; canlı Paraşüt hesabıyla denenmedi.
