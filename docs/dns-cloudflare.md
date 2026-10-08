# Cloudflare DNS (Faz 2.5)

Kod: `src/lib/modules/dns/cloudflare/**` (modül), `src/lib/dns/**` (alan adı ↔ modül, doğrulama, aktivasyon), müşteri ekranı `src/app/musteri/panel/domainler/[id]/dns-section.tsx`, yönetim `/yonetim/dns` ve alan adı detayındaki **DNS (Cloudflare)** kartı.

## 1. Sahip kararı #6 açık → `dns_default_provider`

| Değer | Davranış |
|---|---|
| `registrar` (**varsayılan**, ayar satırı yok) | Bugünkü davranış. Hiçbir alan adı otomatik Cloudflare'e taşınmaz; aktivasyon kancası kuyruğa iş bile eklemez. Müşteri DNS ekranı eski yoldan (dns_records + registrar senkronu) çalışır. Yalnızca yöneticinin **Zone oluştur** ile taşıdığı alan adları Cloudflare'i kullanır. |
| `cloudflare` | Hosting/VDS aktivasyonunda zone + kayıtlar otomatik; müşteri "DNS'i Cloudflare'de yönet" ile kendi alan adını taşıyabilir. |

Ayar: **Yönetim → DNS bölgeleri → Varsayılan DNS sağlayıcısı** (env yedeği `DNS_DEFAULT_PROVIDER`). Aynı kartta `dns_hosting_ip` (hosting IP'si bilinmeyen durumlar için yedek adres).

## 2. Modül (`cloudflare`, kind `dns`)

Ayarlar: API token (gizli; **Zone:Read, Zone:Edit, DNS:Edit**, yalnızca ilgili hesap), Account ID (32 hex, yeni zone'lar buraya açılır), varsayılan proxy, varsayılan TTL (1 = Otomatik), gösterilecek ad sunucuları (vanity NS varsa; boşsa Cloudflare'in atadıkları). Sağlık testi: `GET /user/tokens/verify`.

| Metot | Not |
|---|---|
| `ensureZone` | `GET /zones?name=&account.id=` → yoksa `POST /zones` (`type: full`, `jump_start: true` = mevcut public kayıtlar içe alınır). Eşzamanlı oluşturmada 1061 → yeniden bulur. `status` döner (`active`/`pending`). |
| `listRecords` | Sayfalı (`per_page=100`, `total_pages`'e kadar). TXT tırnakları açılır, SRV/CAA `data`'dan okunur, desteklenmeyen tipler (HTTPS, SVCB…) atlanır. |
| `upsertRecord` | Sözleşme kuralı: CNAME tip+ad, diğerleri tip+ad+içerik. Aynı kayıt → **yazma yok**. Verilmeyen alanlar (TTL/proxy) mevcut değeri korur. Proxy açıkken TTL = otomatik. |
| `deleteRecord` / `deleteZone` | 404/81044 = başarılı (idempotent). `deleteZone` yalnızca yönetici. |

429: `Retry-After` kadar beklenir (en çok 30 sn), 3 yeniden deneme; sonra "Cloudflare istek sınırına ulaşıldı…". Hata kodları `client.ts` → Türkçe mesaj (`reference: "cf:<kodlar>"`). Token hiçbir mesajda/logda yer almaz.

Gerçek API yanıt şekilleri 08.10.2026'da sahibin token'ı ile **salt okunur** GET çağrılarıyla doğrulandı (zone listesi, kleacore.com kayıtları, 81044/7003/6003 hata gövdeleri); anonimleştirilmiş örnekler `__fixtures__/*.json`. Testler `__fixtures__/fake-api.ts` (durum tutan sahte Cloudflare) ile çalışır.

## 3. Veri: `dns_zones` + `dns_records` (karar)

`dns_records` tablosu **kaldırılmadı**, iki modda çalışır:

- **Zone yok** (registrar modu): satırlar kaynak veridir, eski akış aynen (kayıt sonrası `updateRegistrarDnsRecords`).
- **Zone var**: Cloudflare kaynak veridir; satırlar ayna (`providerRecordId` dolu). Her değişiklikten sonra ilgili satır güncellenir; sayfa açılışında ayna 2 dk'dan eskiyse yeniden okunur (`refreshZoneMirrorIfStale`), "Yenile"/"Senkronize et" tam eşitler. Eşitleme `managedBy`'ı silmez.
- `managedBy = "service:<id>"`: hosting/VDS için bizim yazdığımız kayıtlar; müşteri ekranında **Otomatik** etiketli ve kilitli (düzenleme/silme sunucu tarafında da reddedilir).
- İlk zone oluşturulurken eski satırlar doğrulanıp Cloudflare'e kopyalanır (geçersizler `importErrors` olarak raporlanır), ardından ayna Cloudflare'den yeniden kurulur.

Neden: admin sayaçları, API (`dnsRecordCount`), müşteri listesi tek tablodan okumaya devam eder; zone'suz alan adlarında hiçbir şey değişmez.

Migration `20261011100000_dns_zones`: yalnızca ekleme (yeni enum/tablo, `CAA` enum değeri, nullable/varsayılanlı sütunlar, `(domainId, providerRecordId)` benzersiz indeksi — mevcut satırlarda NULL, çakışmaz). Ayar satırı yazmaz.

Not: Gri'nin `updateDnsRecords`'u aslında `change-sub-dns` (alt/glue nameserver) çağrısıdır; registrar modundaki "DNS kayıtları" Gri'de gerçek DNS kaydı olarak yayınlanmıyor olabilir. Bu davranışa dokunulmadı (sahip kararı bekleniyor).

## 4. Aktivasyon kancası (`dns.service-setup` işi)

Kuyruğa ekleme: `queueServiceDnsSetup` — otomatik kurulum başarılı olunca (`retry-queue.ts`, commit sonrası) ve manuel aktivasyonda (`manual.ts`, aynı transaction). `singletonKey = serviceId`. Yalnızca: alan adı aynı müşterinin `Domain` satırı (hostname'in en uzun eşleşen üst alanı) **ve** (zone var **veya** ayar `cloudflare`).

| Hizmet | Kayıtlar |
|---|---|
| Hosting | `@`, `www`, `mail` → sunucu IP (A; IPv6 ise AAAA), proxy kapalı; aynı addaki farklı A/AAAA/CNAME silinir (site yeni hostinge gitmeli). MX `@ → mail.<alan>` (öncelik 0) **yalnız MX yoksa**; SPF `v=spf1 +a +mx +ip4:<IP> ~all` **yalnız SPF yoksa** (Google Workspace vb. korunur). |
| VDS/VPS | Müşterinin seçtiği hostname (`serverName`, yoksa hizmet alan adı) → IP. IP yoksa atlanır. |

Hosting IP sırası: hizmet IP'si → örneğe bağlı `Server` → eski WHM host'u ile eşleşen `Server` → `dns_hosting_ip`. Bulunamazsa iş hata verip yeniden dener (`/yonetim/isler`). Tekrar çalıştırmak güvenli (yazma yapmaz).

## 5. Ekranlar

- **Müşteri** (`/musteri/panel/domainler/[id]`): kayıt listesi (Proxy/Otomatik etiketleri, kilit), ekle/düzenle (tipe özel doğrulama `src/lib/dns/validation.ts`, TTL seçimi, A/AAAA/CNAME proxy anahtarı), silme onay penceresi. Zone varsa **Nameserver'lar** kartı (atanan NS + kopyala, durum); Gri'den kayıtlı ve NS henüz çevrilmemişse **Nameserver'ları Cloudflare'e çevir** (onaylı; `updateRegistrarNameservers` → `Domain.nameservers` + yaşam döngüsü olayı). Ayar `cloudflare` ve zone yoksa **DNS'i Cloudflare'de yönet**.
- **Yönetim**: `/yonetim/dns` (zone listesi, durum sayaçları, ayar kartı); alan adı detayında **DNS (Cloudflare)** kartı: kayıtlar (yönetilenler işaretli), **Zone oluştur / Senkronize et**, **Zone'u sil** (onaylı).

## 6. Açık konular

- Sahip kararı #6 (DNS sahipliği). Karar `cloudflare` ise ayarı çevirmek yeterli; mevcut alan adları için toplu taşıma aracı yok (alan adı başına "Zone oluştur").
- Hizmet feshinde yönetilen kayıtlar silinmiyor (yalnız `managedBy` kalıyor).
- Cloudflare ücretsiz planda proxy'li joker kayıt yok; doğrulama bunu engelliyor.
