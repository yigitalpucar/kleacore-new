# Zamanlanmış görevler (Dokploy cron)

## Neden değişti

Eski `scripts/setup-dokploy-schedules.mjs` görevleri `shellType: "bash"` ve
`curl -H "Authorization: Bearer <CRON_SECRET>" https://kleacore.com/...` komutuyla
oluşturuyordu. Komutlar uygulama konteynerinin içinde çalışır
(`docker exec <id> bash -c '...'`) ve imaj `node:22-alpine` tabanlıdır: içinde
**bash ve curl yok**, bu yüzden tüm görevler başarısız oluyordu. Ayrıca gizli
anahtar Dokploy'daki komut metninde ve görev loglarında açık duruyordu.

## Yeni düzen

- İmajda `/app/cron-run.sh` var (kaynak: `scripts/cron-run.sh`). Busybox `sh` +
  `wget` kullanır, `CRON_SECRET` değerini **konteynerin ortam değişkeninden**
  okur ve uygulamayı `http://127.0.0.1:$PORT` üzerinden çağırır (DNS/TLS'e
  bağımlı değil). HTTP 4xx/5xx durumunda sıfır olmayan kodla çıkar; Dokploy
  çalıştırmayı "hata" olarak işaretler.
- Dokploy'daki komut yalnızca `/app/cron-run.sh <iş>` olur; tırnak, `$` veya
  gizli değer içermez (Dokploy uzak sunucuda komutu `'...'` ve `"..."` içine
  sarar).
- Uygulama tarafında her cron çağrısı JSON log üretir:
  `{"scope":"cron","message":"cron job finished|cron job failed|cron request rejected",...}`.

| Görev adı | Zamanlama (Europe/Istanbul) | Komut |
|---|---|---|
| KLEACORE: Domain Senkronu (Gri) | `0 1 * * *` | `/app/cron-run.sh domain-sync` |
| KLEACORE: Domain Yenileme Faturaları | `30 1 * * *` | `/app/cron-run.sh domain-renewals` |
| KLEACORE: Günlük Faturalama | `0 2 * * *` | `/app/cron-run.sh daily-billing` |
| KLEACORE: Yedeklemeler | `15 * * * *` | `/app/cron-run.sh run-backups` |
| KLEACORE: SSL Süre Kontrolü | `0 4 * * *` | `/app/cron-run.sh ssl-expiry` |
| KLEACORE: Hosting Kullanım Senkronu | `30 4 * * *` | `/app/cron-run.sh usage-sync` |
| KLEACORE: Gecikmiş Faturalar | `0 5 * * *` | `/app/cron-run.sh overdue-invoices` |
| KLEACORE: Otomatik Tahsilat | `30 5 * * *` | `/app/cron-run.sh auto-charge` (kayıtlı kart, docs/payments-saved-cards.md) |
| KLEACORE: Hizmet Askıya Alma | `0 6 * * *` | `/app/cron-run.sh suspend-services` |
| KLEACORE: Domain Süre Bildirimleri | `0 10 * * *` | `/app/cron-run.sh domain-notices` |
| KLEACORE: TCMB Kurları | `15 16,18 * * *` | `/app/cron-run.sh fx-rates` |
| KLEACORE: Provisioning Retry | `*/15 * * * *` | `/app/cron-run.sh retry-provisioning` |
| KLEACORE: E-Fatura Durumları | `*/15 * * * *` | `/app/cron-run.sh efatura-status` |
| KLEACORE: Destek E-postaları | `*/2 * * * *` | `/app/cron-run.sh support-mail` |
| KLEACORE: Destek Otomatik Kapatma | `15 * * * *` | `/app/cron-run.sh support-autoclose` |
| KLEACORE: Bildirimler | `20 8-21 * * *` | `/app/cron-run.sh notifications` |
| KLEACORE: İş Kuyruğu | `* * * * *` | `/app/cron-run.sh jobs-drain` |

- `efatura-status`: `syncEInvoiceStatuses({ limit: 100 })` — Uyumsoft'ta `SENT`
  durumundaki belgelerin durumunu sorgular (en eski kontrol edilen önce). e-Fatura
  kapalıyken kayıt olmadığı için hemen biter.
- `support-mail`: etkin destek posta kutularını (IMAP) okur, okunmamış iletileri
  talebe / yanıta çevirir (ayrıntı: `docs/ops-support-mail.md`). Posta kutusu
  yoksa hemen biter. Okuma süresi kilit içinde geçer; üst üste binen çalıştırma
  `locked` döner.
- `support-autoclose`: müşteri yanıtı beklenen talepler için gün-1 uyarısı ve
  otomatik kapatma (Ayarlar: `/yonetim/destek/ayarlar`, varsayılan 5 gün).
- `usage-sync`: cPanel/WHM hesaplarının disk ve bu ayki bant genişliği
  kullanımı. Cron yalnızca örnek başına bir `hosting.usage-sync` kuyruk işi açar
  (ayrıntı: `docs/ops-jobs.md`); WHM yavaşsa kilidi tutmaz. Hiç bağlı hizmet
  yoksa `processed: 0` ile biter. Yeni görevi eklemek için §Operatör adımları 4
  (`setup-dokploy-schedules.mjs`) yeniden çalıştırılmalı.
- `fx-rates`: TCMB `today.xml` bülteninden USD/EUR/GBP döviz alış/satış ve
  efektif satış kurlarını `exchange_rates` tablosuna yazar (para birimi + bülten
  tarihi başına bir satır, tekrar çalıştırmak güvenli). Hafta sonu/tatilde yeni
  bülten olmadığından son kur geçerli kalır. TLD fiyat kuralında "otomatik
  uygula" açıksa (varsayılan kapalı) önerilen fiyatları yazar ve
  `activity_logs`'a kaydeder; tek seferde %30'dan büyük değişimleri atlar.
  Geçmiş gün: `/api/cron/fx-rates?date=2026-09-01` (arşivden, otomatik
  uygulama yok). Ayrıntı: `docs/fx-tld-pricing.md`.
- `notifications`: saat başı (08–21) "fatura oluştu" (yenileme / elle oluşturulan
  faturalar), "vade -3 gün" hatırlatması ve gözden kaçan "gecikti" bildirimleri;
  hepsi fatura × tür başına **bir kez** (`NotificationLog.dedupeKey`). Ayrıca kuyruğa
  girememiş (`QUEUED`, >10 dk) bildirimleri yeniden kuyruğa koyar.
  "Gecikti" bildirimi asıl olarak `overdue-invoices` (05:00) içinde, fatura
  `OVERDUE` olduğu anda gider.

Aynı görev aynı anda iki kez çalışmaz (Postgres advisory lock); ikinci çağrı
`{"status":"locked"}` döner. Çalıştırmalar `cron_runs` tablosuna yazılır ve
/yonetim/isler'de görünür. Kuyruk ve işçi modeli: `docs/ops-jobs.md`.

### Domain yaşam döngüsü görevleri

Sıra bilinçli: önce registrar senkronu (bitiş tarihleri güncel olsun), sonra
yenileme faturaları, bildirimler gündüz.

- **domain-sync** (01:00): `ACTIVE`/`TRANSFERRING`/`EXPIRED` domainleri Gri'den
  sorgular (`GET /api/v2/domain/{ad}`), en eski senkronlanan önce, çağrı başına
  400 ms bekleme, çalıştırma başına en çok 200 domain. Bitiş tarihi, durum
  (TRANSFERRING→ACTIVE dahil) ve nameserver farkları domain geçmişine
  (`domain_lifecycle_events`) yazılır; registrar'dan boş/eksik gelen değer
  mevcut veriyi asla silmez. Gri etkin değilse veya API bilgileri eksikse hiçbir
  şey yapmaz, `cron_runs` özetinde `registrar: "not-configured"` görünür.
- **domain-renewals** (01:30): `ACTIVE` + otomatik yenilemesi açık domainlere,
  bitişten `domain_renewal_invoice_days` gün (ayar, varsayılan 30) önce yenileme
  faturası keser (TLD `renewPrice` × yıl + KDV). `domain_renewals` tablosundaki
  `(domainId, periodStart)` benzersiz anahtarı sayesinde aynı dönem için ikinci
  fatura oluşmaz. Ayrıca ödenmiş ama kuyruğa girmemiş yenilemeleri `domain.renew`
  kuyruğuna ekler, iptal edilen faturaların yenilemelerini kapatır.
- **domain-notices** (10:00): 30/7/1 gün kala, süre dolunca, ek süre bitmeden
  (`domain_grace_days`, varsayılan 30) ve geri alma sürecinde
  (`domain_redemption_days`, varsayılan 30) müşteriye bildirim. Her tür, domain +
  dönem başına bir kez (`domain_notices`). Bitişi geçmiş `ACTIVE` domainler
  `EXPIRED` yapılır.

Ödeme sonrası registrar yenilemesi cron değil, kuyruk işidir (`domain.renew`,
bkz. `docs/ops-jobs.md`): 5 deneme, son hata yöneticiye bildirim + /yonetim/isler.

Hepsi: `scheduleType: "application"`, `shellType: "sh"`, `enabled: true`.

## Operatör adımları

1. **Önce** bu dalı içeren imajı yayınlayın (`/app/cron-run.sh` imajda olmalı).
2. Uygulamanın Dokploy ortam değişkenlerinde `CRON_SECRET` tanımlı olduğunu
   doğrulayın (konteyner içinde: `docker exec <id> sh -c 'test -n "$CRON_SECRET" && echo ok'`).
3. Konteyner içinde elle deneyin (zararsız bir iş seçin, ör. SSL kontrolü):

   ```sh
   docker exec <app-container> /app/cron-run.sh ssl-expiry
   ```

   Beklenen çıktı: `cron-run: POST /api/cron/ssl-expiry` ve ardından
   `{"success":true,...}`; çıkış kodu 0.
4. Görevleri senkronlayın. Betik görevleri **ada göre eşler**: var olanları
   `schedule.update` ile düzeltir, eksikleri `schedule.create` ile ekler
   (kopya oluşturmaz). Önce ne gönderileceğini görün:

   ```sh
   node scripts/setup-dokploy-schedules.mjs --dry-run
   ```

   Sonra uygulayın (`DOKPLOY_URL` `/api` ile bitmeli; `CRON_SECRET` artık
   gerekmez):

   ```sh
   DOKPLOY_URL=https://<dokploy-host>/api \
   DOKPLOY_API_KEY=<api-key> \
   node scripts/setup-dokploy-schedules.mjs --application-id=wJ-OFQk0M8mJsgGVvXbu7
   ```

5. Dokploy arayüzünde bir görevi "Run now" ile çalıştırıp logunda
   `✅ Command executed successfully` görün.

### Betiği kullanmadan elle düzeltme

Dokploy → Uygulama → Schedules → her görevi düzenleyin: **Shell type = sh**,
**Command = tablodaki komut**. Eski `curl ... Bearer <gizli>` komutlarını
kaldırın; gizli değer o loglarda göründüğü için `CRON_SECRET` değerini
yenilemek (ve Dokploy ortam değişkenini güncellemek) önerilir.

## Yerel deneme

```sh
docker build -t kleacore:local .
docker run -d --name kc -p 3310:3000 -e DATABASE_URL=... -e CRON_SECRET=test -e AUTH_SECRET=... kleacore:local
docker exec kc /app/cron-run.sh ssl-expiry   # 0 ile çıkar
docker exec -e CRON_SECRET=yanlis kc /app/cron-run.sh ssl-expiry   # 401 → 1 ile çıkar
```
