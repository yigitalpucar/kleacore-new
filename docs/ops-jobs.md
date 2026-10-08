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
