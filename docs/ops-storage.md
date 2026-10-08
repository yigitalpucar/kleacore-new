# Dosya depolama (ticket ekleri)

Destek taleplerine eklenen dosyalar `src/lib/storage/` katmanında saklanır.
Kod tek bir arayüz kullanır (`StorageDriver`: `put / get / delete`); sürücü
ortam değişkeniyle seçilir. Her dosya kaydı (`ticket_attachments`) hangi
sürücüde durduğunu (`storageDriver`) kendisi tutar, bu yüzden sonradan S3'e
geçmek eski dosyaları okunmaz yapmaz.

## Güvenlik modeli

- **Depolama anahtarı rastgele:** `tickets/<yyyy>/<mm>/<uuid>`. Kullanıcının
  verdiği dosya adı hiçbir zaman yol ya da anahtar olmaz; yalnızca
  `fileName` sütununda görüntüleme için saklanır (yol parçaları, kontrol ve
  bidi karakterleri temizlenir). Sürücüler kalıba uymayan anahtarı reddeder
  (`..`, `/` ile başlayan, `\`, büyük harf vb.) ve yerel sürücü çözülen yolun
  kök dizinin içinde kaldığını ayrıca doğrular.
- **Tür içerikten belirlenir** (magic bytes, `src/lib/storage/sniff.ts`),
  istemcinin bildirdiği Content-Type kullanılmaz. İzin verilenler: PNG, JPEG,
  GIF, WEBP, PDF, TXT/LOG/CSV, ZIP, RAR, 7z, DOC/XLS/PPT, DOCX/XLSX/PPTX,
  ODT/ODS/ODP ve betik içermeyen SVG. Uzantı, tespit edilen türle uyuşmalıdır
  (`.pdf` adlı bir `.exe` reddedilir). Çalıştırılabilir dosyalar (PE/ELF/
  Mach-O/WASM), betikler (`#!`, PHP), HTML, makrolu Office (vbaProject.bin) ve
  script / olay işleyici / dış bağlantı içeren SVG reddedilir.
- **Sınırlar:** dosya başına 10 MB, ileti başına 5 dosya; istek gövdesi
  51 MB'ı geçince okunmadan kesilir (413).
- **İndirme yalnızca yetkili rotadan:** `GET /api/support/attachments/<id>`
  oturum ister; talebin müşterisi ya da destek personeli (ADMIN, ileride
  SUPPORT) indirebilir, başkası 404 alır (dosyanın varlığı sızmaz). Yanıt
  her zaman `Content-Disposition: attachment`, `X-Content-Type-Options:
  nosniff`, `Content-Security-Policy: default-src 'none'; sandbox` ve
  `Cache-Control: private, no-store` ile gider. Dosyalar `public/` altında
  değildir; S3 kovası da **özel** olmalıdır.
- Veritabanı yazımı başarısız olursa o istekte yazılan dosyalar silinir
  (yetim dosya kalmaz).
- Eski kayıtlar (`ticket_messages.attachments` JSON'unda yalnızca dosya adı
  olanlar) ekranda "dosya mevcut değil" olarak gösterilir; içerikleri hiç
  yüklenmemişti.

## Yerel disk (varsayılan)

| Değişken | Varsayılan |
|---|---|
| `STORAGE_DRIVER` | `local` |
| `STORAGE_LOCAL_DIR` | production: `/app/uploads`, geliştirme: `./.uploads` (git'e girmez) |

Dosyalar `0600`, dizinler `0700` izinle, geçici dosya + `rename` ile atomik
yazılır. İmaj `/app/uploads` dizinini `nextjs` (uid 1001) kullanıcısına ait
oluşturur.

### Dokploy: kalıcı volume bağlama

Konteyner her deploy'da yeniden oluşturulur; volume bağlanmazsa **tüm ekler
kaybolur**. Bir kez yapılır:

1. Dokploy → KLEACORE uygulaması → **Advanced → Volumes / Mounts → Add Mount**.
2. Tür: **Volume Mount** (named volume). Volume adı: `kleacore-uploads`.
   Mount path: `/app/uploads`.
3. Kaydet → **Redeploy**. İş kuyruğu worker'ı ayrı servis olarak çalışıyorsa
   aynı volume'u aynı yola onun için de bağlayın (gelen e-posta ekleri cron
   rotasında yani uygulama konteynerinde yazılır, ama ileride işe taşınırsa
   gerekir).
4. Doğrulama: panelden bir talebe küçük bir PDF ekleyin, indirin; sonra
   redeploy edip tekrar indirin (aynı dosya gelmeli).
   `docker exec <app> ls -la /app/uploads/tickets` → sahibi `nextjs`.

Bind mount (`/srv/kleacore/uploads:/app/uploads`) kullanılacaksa host
dizininin sahibi uid/gid `1001` olmalı: `chown -R 1001:1001 /srv/kleacore/uploads
&& chmod 700 /srv/kleacore/uploads`.

**Yedek:** volume, Postgres yedeğinden ayrıdır. Dokploy'da volume yedeği
(Volume Backups) tanımlayın ya da host'ta `/var/lib/docker/volumes/kleacore-uploads`
dizinini günlük yedeğe ekleyin. DB'deki `ticket_attachments.sha256` ile
bütünlük doğrulanabilir.

## S3 uyumlu depolama (ileride)

`STORAGE_DRIVER=s3` ve `S3_ENDPOINT`, `S3_REGION`, `S3_BUCKET`,
`S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` (+ `S3_FORCE_PATH_STYLE=false`
virtual-host stili için). AWS S3, Cloudflare R2, MinIO, Wasabi ile çalışır
(SigV4, `aws4fetch`). Kova herkese kapalı olmalı; erişim anahtarına yalnızca
o kovada `GetObject / PutObject / DeleteObject` yetkisi verin. Geçişte eski
yerel dosyalar `storageDriver = 'local'` olarak okunmaya devam eder; taşımak
için dosyaları aynı anahtarla kovaya kopyalayıp satırların `storageDriver`
değerini `s3` yapmak yeterlidir.
