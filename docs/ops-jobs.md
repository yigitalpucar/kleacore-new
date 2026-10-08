# Arka plan işleri (pg-boss kuyruğu) ve cron kilitleri

Alan adı yenileme, bildirim ve provisioning gibi işler artık **pg-boss** kuyruğundan
çalışır. Kuyruk aynı Postgres veritabanında, Prisma'nın `public` şemasının yanında
kendi **`pgboss`** şemasındadır (`DATABASE_URL` aynı; şemayı pg-boss ilk açılışta
kendisi kurar ve günceller, Prisma migration'ı gerekmez).

Yönetim ekranı: **/yonetim/isler** (Sistem → Arka plan işleri).

## Kod haritası

| Dosya | Görev |
|---|---|
| `src/lib/jobs/definitions.ts` | İş kayıt defteri: ad → zod şeması → handler (+ retry/backoff ayarı) |
| `src/lib/jobs/registry.ts` | `defineJob`, `createRegistry` (ad/ayar doğrulaması) |
| `src/lib/jobs/enqueue.ts` | `enqueue(name, payload, { singletonKey, startAfter, retryLimit, tx })` |
| `src/lib/jobs/worker.ts` | `startWorker()` (uzun süreli işçi), `drainJobs()` (istek içinde boşaltma) |
| `src/lib/jobs/boss.ts` | Süreç başına tek pg-boss örneği, kuyrukların oluşturulması |
| `src/lib/jobs/heartbeat.ts` | `job_worker_heartbeats` tablosu, `/api/health` için işçi canlılığı |
| `src/lib/cron/lock.ts`, `run-log.ts` | Cron advisory lock + `cron_runs` kaydı |
| `scripts/worker.ts` → `/app/worker.mjs` | Ayrı işçi servisi giriş noktası (esbuild ile paketlenir) |

### Yeni iş eklemek

```ts
// src/lib/jobs/definitions.ts
export const domainRenewJob = defineJob({
  name: "domain.renew",
  label: "Alan adı yenileme",
  schema: z.object({ domainId: z.string().min(1) }),
  queue: { policy: "exclusive", retryLimit: 5, retryDelay: 600, retryBackoff: true },
  handler: async ({ domainId }, ctx) => (await import("@/lib/domains/renew")).renewDomain(domainId, ctx),
});
const definitions = [provisioningRunJob, domainRenewJob] as const;
```

```ts
await enqueue("domain.renew", { domainId }, { singletonKey: domainId, tx });
```

- **İdempotency:** `policy: "exclusive"` + `singletonKey` → aynı anahtarla sırada,
  yeniden denemede veya çalışmakta olan bir iş varken ikinci `enqueue` düşer
  (`{ deduplicated: true }`). `standard` kuyrukta `singletonKey` reddedilir.
- **Transaction:** `tx` (Prisma interactive transaction) verilirse iş, iş verisiyle
  birlikte commit/rollback olur (transactional outbox).
- Handler hata fırlatırsa pg-boss `retryLimit`/backoff ile tekrar dener; son
  denemede iş `failed` olur ve admin ekranında görünür. `ctx.isFinalAttempt`
  son denemeyi belirtir.

## İşçi modeli

İki yol var; ikisi aynı anda da çalışabilir (pg-boss işleri `SKIP LOCKED` ile
dağıtır, bir iş iki kez alınmaz).

### (b) Varsayılan: dakikalık drain cron'u — ek servis gerekmez

`/api/cron/jobs-drain` sıradaki işleri istek içinde, **45 sn bütçeyle**
(`JOBS_DRAIN_BUDGET_MS`) tek tek işler, pg-boss bakımını (süresi dolan aktif işler,
saklama) çalıştırır ve `drain` heartbeat'ini yazar. Dokploy görevi:

| Görev adı | Zamanlama | Komut |
|---|---|---|
| KLEACORE: İş Kuyruğu | `* * * * *` | `/app/cron-run.sh jobs-drain` |

`node scripts/setup-dokploy-schedules.mjs` bu görevi diğerleriyle birlikte
oluşturur/düzeltir (bkz. `docs/ops-cron.md`). Gecikme: bir iş en geç ~1 dk
içinde ele alınır. Bu yol, ayrı işçi kurulduktan sonra da **açık kalmalı**
(yedek görevi görür).

### (a) Ayrı işçi servisi — aynı imaj, farklı komut

Daha düşük gecikme (≈2 sn) ve uzun işler için:

1. Dokploy'da aynı projede yeni bir **Application** oluşturun; kaynak olarak
   web uygulamasıyla **aynı GitHub deposu/dalı ve Dockerfile**'ı seçin (ya da
   aynı imajı kullanın).
2. **Command / Args:** `./docker-entrypoint.sh worker` (Dokploy'da "Command"
   alanı; ENTRYPOINT'e `worker` argümanı geçmek de yeterli).
3. Ortam değişkenleri: web uygulamasınınkilerle aynı (en az `DATABASE_URL`,
   `ENCRYPTION_KEY`, provisioning/registrar/SSL/SMTP ayarları). İsteğe bağlı:
   `JOBS_WORKER_CONCURRENCY` (vars. 2), `JOBS_POOL_MAX` (vars. 6).
4. **Domain eklemeyin.** İşçi yalnızca imajın Docker HEALTHCHECK'i için
   `$PORT` üzerinde `/api/health` yanıtlar.
5. Migration çalıştırmaz (web servisi çalıştırır); yalnızca pg-boss kendi
   şemasını yönetir. Deploy sırası: önce web, sonra worker.
6. `SIGTERM`'de aktif işleri bitirip (en çok 30 sn) kapanır.

Yerelde: `pnpm jobs:worker` (tsx) veya `pnpm build && node --env-file=.env .worker/worker.mjs`.

## Provisioning'in kuyruğa taşınması

- `ProvisioningJob` tablosu (`/yonetim/provisioning`) admin kaydı olarak kaldı.
  Hata anında satır yazılırken aynı transaction içinde `provisioning.run` işi
  kuyruğa eklenir (`singletonKey` = satır id'si). Deneme/backoff'u artık pg-boss
  yönetir: toplam 5 deneme, ≈10–20 dk, 20–40 dk, 40–80 dk, 80–160 dk.
- Ödeme sonrası askı kaldırma (UNSUSPEND) yine commit'ten hemen sonra istek
  içinde denenir; kuyruk işi 60 sn sonra yedek olarak çalışır (satır
  tamamlanmışsa hiçbir şey yapmaz). Satır `PENDING→PROCESSING` koşullu güncelleme
  ile sahiplenildiği için ikisi aynı anda çalışmaz.
- `/api/cron/retry-provisioning` (15 dk) artık **eşitleme** yapar: kuyruğa
  girmemiş `PENDING` satırları (eski kayıtlar, kuyruk erişilemezken yazılanlar,
  çöken `PROCESSING` satırlar) kuyruğa ekler. Mükerrer eklemez.
- `/yonetim/provisioning`'deki "Yeniden dene" eskisi gibi anında çalışır;
  başarılı olursa kuyruktaki başarısız kaydı da temizler.

## Ödeme sonrası akış (kart, havale onayı, admin "ödendi")

Ödeme callback'i (Kuveyt Türk, iyzico, PayTR, Stripe webhook) veya admin onayı
**tek kısa transaction** açar: Payment `COMPLETED`, fatura `PAID` (koşullu güncelleme,
tekrar gelen callback no-op), sipariş `COMPLETED`, yenileme/paket değişikliği,
yerel kayıtlar (alan adı `PENDING`, SSL sertifikası `PENDING`, hizmet satırı),
`ProvisioningJob` satırı ve şu kuyruk işleri — hepsi aynı commit'le:

| İş | Ne yapar | Tekrar |
|---|---|---|
| `provisioning.run` | Registrar kaydı/transferi, SSL siparişi, WHM/VPS oluşturma, paket değişikliği (`PLAN_CHANGE`), askı kaldırma | 5 deneme, backoff; sonra `FAILED` |
| `efatura.issue` | Uyumsoft/Paraşüt e-fatura/e-arşiv kesimi | 6 deneme; fatura verisi hatası (`EFATURA_…:`) tekrar denenmez, `/yonetim/e-fatura`'da görünür |
| `payment.settled` | Webhook/aktivite olayları + "ödeme alındı" bildirimi (`billing.payment-received`, fatura başına tek gönderim) | 4 deneme |

Transaction içinde **hiçbir uzak çağrı yapılmaz**; bu yüzden registrar/WHM/SSL
hatası artık kart çekimini geri almaz. Sipariş verisi bozuksa (ör. alan adı
olmayan SSL) iş `FAILED` olarak, nedeniyle birlikte `/yonetim/provisioning`'de
görünür; siparişi düzeltip "Yeniden dene" yeterlidir. Siparişin etkinleştirilmesi
beklenmedik bir hatayla patlarsa (ör. yenilenecek hizmet silinmiş) yalnızca o kısım
bir SAVEPOINT'e geri alınır, ödeme kalır; sipariş `PROCESSING`, iş
`FAILED` (`FULFILMENT_ERROR: …`) olur. Kuyruk o an erişilemezse ödeme yine
kaydedilir; takip işleri commit'ten sonra yeniden kuyruğa eklenir, olmazsa aynı
istekte çalıştırılır.

Otomasyonu olmayan ürünlerde (`manual_provisioning_categories`, ör. VDS) aynı
transaction `provisioning.run` yerine `MANUAL` görev açar (aşağıya bakın); yönetim
bildirimi `notification_logs` + kuyruk üzerinden commit ile birlikte gider.

## Bildirimler (`notification.send`)

Kod: `src/lib/notifications/` — yönetim: **/yonetim/bildirimler** (kayıtlar, filtre,
"Yeniden gönder"), **/yonetim/bildirimler/sablonlar** (örnek veriyle önizleme).

```ts
import { sendNotification } from "@/lib/notifications/send";
await sendNotification({
  userId,                          // alıcı hesap (e-posta/telefon/ad buradan)
  template: "domain.expiry-notice", // src/lib/notifications/templates/*
  data: { domain, daysLeft, renewUrl },
  channel: "EMAIL",                // isteğe bağlı; varsayılan e-posta (+ SMS açıksa)
  dedupeKey: `domain.expiry:${id}:${daysLeft}`, // isteğe bağlı: anahtar×kanal başına tek gönderim
  tx,                               // isteğe bağlı: iş verisiyle aynı transaction
});
```

- Her kanal için bir `notification_logs` satırı (`QUEUED`) yazılır ve `notification.send`
  işi kuyruğa girer; iş şablonu işler, SMTP (Ayarlar → E-posta, `smtp_*`) veya SMS
  sağlayıcısıyla gönderir: `SENT` (sağlayıcı ileti no), `SKIPPED` (SMTP/SMS kapalı) ya da
  5 denemeden sonra `FAILED`. `sendNotification` hiçbir zaman hata fırlatmaz.
- Şablonlar tipli TS modülleridir (zod şeması + Türkçe konu + ortak HTML düzeni + düz
  metin + isteğe bağlı SMS). Logo satır içi CID eki; dış görsel/izleme yok.
- Gizli alanlar (`sensitive`: ilk şifre, doğrulama/sıfırlama bağlantısı) kuyruk
  yükünde ve log'da şifreli (`enc:v1:`), müşteri gelen kutusu kopyasında ve yönetim
  önizlemesinde "•••••• (gizli)" olarak durur; log `redacted=true`.
- SMS yalnızca `sms_notifications=true` + yapılandırılmış sağlayıcı + telefon varsa yazılır.
- Yönetim bildirimleri: `admin_notification_email` (yoksa `support_email`,
  `company_email`), SMS için `admin_notification_phone`.
- Yerelde: `docker run -d -p 1025:1025 -p 8025:8025 axllent/mailpit`, Ayarlar'da
  `smtp_server=localhost`, `smtp_port=1025` (kullanıcı/şifre boş olabilir), sonra
  `pnpm jobs:worker` ya da `/api/cron/jobs-drain`; e-postalar http://localhost:8025.

## Manuel kurulum (ProvisioningJob `kind = MANUAL`)

Otomasyon modülü olmayan ürünlerin ödemesi alındığında (`manual_provisioning_categories`
— varsayılan `vds` —, WHM/Virtualizor yapılandırılmamış kategoriler, `datacenter` vb.)
hizmet `PENDING` ("Kurulum sürüyor") açılır, `MANUAL` görev + yönetime e-posta/SMS +
panel bildirimi oluşur. **/yonetim/kurulumlar** → görev → IP, sunucu adı, kullanıcı,
ilk şifre (ya da "ayrıca iletildi"), notlar → **Aktifleştir**: hizmet `ACTIVE`, dönem
bugünden başlar, şifre şifreli saklanır, müşteriye "hizmet aktif" gider. SLA hedefi
`manual_provisioning_sla_hours` (24), müşteriye gösterilen süre metni
`manual_provisioning_eta_text`. MANUAL görevler `provisioning.run` kuyruğuna girmez.

## Cron kilidi ve çalışma kaydı

Her `/api/cron/*` çağrısı:

1. `pg_try_advisory_lock(hashtext('kleacore:cron'), hashtext(<iş>))` ile ayrı bir
   bağlantı üzerinden kilit alır. Kilit başka bir çalıştırmadaysa iş **çalışmaz**,
   yanıt `200 {"status":"locked"}` olur ve `cron_runs`'a `LOCKED` satırı yazılır
   (`cron-run.sh` çıkış kodu 0). Süreç ölürse bağlantı kapanır, kilit kendiliğinden
   bırakılır.
2. `cron_runs` tablosuna `RUNNING` → `SUCCEEDED`/`FAILED` (süre, özet JSON, hata)
   yazar. Kilit alındığında kalmış `RUNNING` satırları "yarıda kaldı" olarak
   kapatılır. 90 günden eski kayıtlar silinir. `jobs-drain` kaydedilmez (dakikada
   bir satır olmasın diye); canlılığı heartbeat'ten izlenir.
3. Tekrar çalıştırmalar idempotent: faturalama mevcut açık faturayı, gecikme/askı
   işleri durum geçişlerini, yedekleme `nextRunAt`'i kontrol eder. Müşteriye
   bildirim gönderen `ssl-expiry` günde bir kez çalışır (aynı gün ikinci başarılı
   çalıştırma `SKIPPED`); zorlamak için `?force=1`.

## Sağlık kontrolü

`GET /api/health` → `checks.jobs`:

- `ok`: son `JOBS_WORKER_STALE_MINUTES` (vars. 5) dakikada bir işçi ya da drain
  çalıştırması heartbeat yazdı.
- `degraded`: yazmadı (drain cron'u kurulmamış/çalışmıyor ve işçi yok). Genel
  `status` `degraded` olur ama **HTTP 200** döner; konteyner sağlıksız sayılmaz.
- Yalnızca veritabanı hatası 503 döndürür.

## Sorun giderme

- `/yonetim/isler` → "İşçiler" boşsa: drain görevi Dokploy'da yok/devre dışı.
  Konteynerde elle: `docker exec <app> /app/cron-run.sh jobs-drain`.
- "Sorunlu işler" → **Yeniden dene** işi kuyruğa geri koyar ve hemen (≤25 sn)
  çalıştırır; sonuç bildirimle gösterilir. **İptal** sıradaki işi iptal eder,
  başarısız işi listeden kaldırır (provisioning işiyse ilgili kayıt `FAILED`
  olur ve eşitleme onu tekrar kuyruğa almaz).
- pg-boss tabloları: `pgboss.job` (durumlar: created, retry, active, completed,
  failed, cancelled). Sonuçlanan işler (tamamlanan, başarısız, iptal) 7 gün sonra
  pg-boss bakımıyla silinir; ProvisioningJob kaydı kalıcıdır.
