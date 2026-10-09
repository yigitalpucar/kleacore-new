# Proxmox VE modülü (Faz 2.3)

VDS/VPS'leri Proxmox VE üzerinde cloud-init şablonundan otomatik açar, yönetir ve kapatır.

- Kod: `src/lib/modules/server/proxmox/` (`index.ts` manifest + sözleşme, `client.ts` API istemcisi, `parse.ts` saf yardımcılar)
- Panel/yardımcılar: `src/lib/modules/server-panel.ts`, müşteri `src/components/panel/vds-panel.tsx`, yönetim `src/components/admin/modules/proxmox-service-card.tsx`
- Testler: `proxmox.contract.test.ts` (durum tutan sahte PVE: `fake-pve.ts`). **Hiçbir test gerçek Proxmox'a gitmez.**
- Genel modül sistemi: `docs/modules.md`

## 1. Kurulum özeti

1. Proxmox'ta en az yetkili API token'ı oluşturun (§6).
2. `/yonetim/moduller` → Proxmox VE → yeni örnek: API adresi, token kimliği + gizli anahtar, node, TLS, depolama, köprü, VMID aralığı, (ops.) pool. **Bağlantıyı test et** → `GET /version` + `GET /nodes/{node}/status`.
3. `/yonetim/ip-havuzları` → havuz oluşturun ve bu örneğe bağlayın (ağ geçidi, DNS, varsa VLAN).
4. VDS ürününü düzenleyin → **Otomasyon** → örneği seçin, seçenekleri girin (§3). Bağ, `manual_provisioning_categories` ayarını geçersiz kılar: ürün artık otomatik kurulur.

## 2. Örnek ayarları (`configSchema`)

| Alan | Varsayılan | Not |
|---|---|---|
| `apiUrl` | — | `https://188.132.235.28:8006` |
| `tokenId` | — | `kullanıcı@realm!token-adı` (ör. `kleacore@pve!kleacore`) |
| `tokenSecret` | — | **Gizli** (şifreli saklanır, maskelenir, tarayıcıya hiç gitmez). İstek başlığı: `Authorization: PVEAPIToken=<tokenId>=<secret>` |
| `node` | — | VM'lerin açılacağı node |
| `verifyTls` | açık | Kapatmak yalnızca test içindir (sağlık kontrolü uyarı gösterir). |
| `caCert` | — | `/etc/pve/pve-root-ca.pem` içeriği. Kendinden imzalı sertifikayı **doğrulayarak** kullanmanın yolu budur (PVE sertifikası node IP'lerini SAN'da taşır). |
| `defaultStorage` | `local-lvm` | Tam klonun hedef depolaması |
| `bridge` | `vmbr0` | |
| `vmidStart` / `vmidEnd` | 1000 / 1999 | Modül yalnızca bu aralıkta VMID kullanır |
| `pool` | — | Doluysa yeni VM'ler bu pool'a girer (token yetkisi pool üzerinden verilebilir) |
| `nameservers` | 1.1.1.1, 8.8.8.8 | IP havuzunda DNS yoksa |
| `taskTimeoutSeconds` | 420 | Bir denemede görev bekleme süresi (kuyruk işi 10 dk'da sona erer). Aşılırsa iş sonraki denemede **aynı UPID'i** bekleyerek devam eder. |
| `testDisableKvm` | kapalı | **Yalnızca test**: VM'lere `kvm: 0` yazar (§7) |

## 3. Ürün seçenekleri (`productOptionsSchema`)

`templateVmid` (zorunlu, ör. 9000), `cores`, `memoryMB`, `diskGB` (şablon diski bu boyuta **büyütülür**, küçültülmez), `storage` / `bridge` / `vlan` (örnek veya havuz değerini ezer), `ipPoolId` (boşsa örneğe bağlı ilk havuz), `osLabel` (müşteri panelinde), `ciUser` (cloud-init kullanıcısı, varsayılan `kleacore`).

## 4. Akışlar

### 4.1 Kurulum (`createAccount`) — devam ettirilebilir, idempotent

Ödeme → `provisioning.run` işi → köprü → modül. Her adım önce uzak durumu kontrol eder; ilerleme `Service.moduleData.proxmox` içinde tutulur (yeni nullable JSONB sütun):

1. **Arama**: `GET /cluster/resources?type=vm`. Kayıtlı VMID veya `kc-<hizmet-id-son-12>` adlı VM varsa ve açıklamasında `kleacore-service:<hizmetId>` **sahiplik işareti** varsa o VM kullanılır (ikinci klon açılmaz). Aynı adlı ama işaretsiz VM'e dokunulmaz → hata, yönetici incelemesi.
2. **IP**: `allocateIp(havuz, hizmet)` (hizmet başına idempotent; tekrar denemede aynı adres).
3. **VMID + klon**: aralıkta listede olmayan ilk numara `GET /cluster/nextid?vmid=N` ile doğrulanır; `POST /nodes/{şablonNode}/qemu/{şablon}/clone` (`full=1`, `storage`, `pool`, `name`, `description`=işaret). Klon "already exists" ile reddedilirse (yarış) bir sonraki numara denenir (5 kez). UPID kaydedilir, `GET /nodes/{node}/tasks/{upid}/status` 1→5 sn artan aralıkla yoklanır.
4. **Kilit**: klon sürerken VM yer tutucu (`lock: clone`) yapılandırmasıyla görünür; devam eden deneme kayıtlı UPID'i bekler.
5. **Yapılandırma** (`PUT …/config`, her denemede yeniden uygulanır): `name`, `description`, `tags=kleacore`, `cores`, `memory`, `onboot=1`, `ciuser`, `cipassword`, `ipconfig0=ip=<ip>/<prefix>,gw=<gw>`, `nameserver`, varsa `sshkeys` (PVE'nin istediği gibi URL-kodlu), köprü/VLAN farklıysa MAC korunarak `net0`, testte `kvm=0`.
   Şifre: ilk denemede üretilir (20 karakter), **şifreli** (`enc:v1:`) `moduleData`'ya yazılır, sonraki denemeler aynı şifreyi kullanır. Log'a, hata mesajına, e-postaya ve köprü sonucuna **yazılmaz**.
6. **Disk**: önyükleme diski (`boot: order=…`, cloud-init/CD-ROM hariç) hedeften küçükse `PUT …/resize` (görev ise beklenir).
7. **Başlat**: çalışmıyorsa `POST …/status/start` → görev beklenir.
8. Köprü `Service.remoteId=VMID`, `ipAddress`, `username` yazar; müşteriye "hizmet aktif" e-postası (IP + kullanıcı; şifre yerine "panelde bir kez görüntüleyin").

Hata kodları adımı söyler: `PROXMOX_LOOKUP | _IP | _CLONE | _CONFIG | _RESIZE | _START | _POWER | _DESTROY | _USAGE | _VM: <ayrıntı>`; son hata `moduleData.proxmox.lastError` ve `ProvisioningJob.lastError`'da görünür.

### 4.2 Kalıcı başarısızlık

İş son denemede de başarısız olursa (veya yönetici yeniden denemesi başarısız olursa) `abandonModuleProvisioning` → modülün `abandonProvisioning`'i: hizmetin IP'leri **havuza bırakılır**, `needsAdmin` notu yazılır ("VM 1000 bırakıldı…"). **VM asla otomatik silinmez.** Yönetici hizmet detayındaki **Proxmox** kartından: son hata, son görev kaydı (`GET …/tasks/{upid}/log`), "Proxmox'ta aç" bağlantısı (PVE arayüzü, yönetici kendi PVE girişiyle) ve **Proxmox'ta yeniden dene** (işi sıfır deneme sayısıyla kuyruğa alır; modül mevcut VM'den devam eder, IP'yi yeniden ayırır ve yapılandırmayı yeniden uygular).

### 4.3 Askı / askıdan çıkarma

- **Askı** = düzgün kapatma (`shutdown timeout=60 forceStop=1`) + `onboot=0` (node yeniden başlasa da VM kapalı kalır).
- PVE `lock` **kullanılmaz**: müşterinin Proxmox erişimi yok, panel faturalı/yönetici askısındaki sunucuyu başlatmayı zaten reddeder (`server-power.ts`, `CUSTOMER_STOPPED` kuralı aynen geçerli); kilit ise yöneticiyi ve yedeklemeyi de engellerdi.
- **Askıdan çıkarma** = `onboot=1` + başlat.

### 4.4 Fesih (`terminate`)

Yalnızca açık yönetici işlemiyle çalışır: hizmet detayı → **Hizmeti iptal et** (onay metni VM'in kalıcı silineceğini söyler) veya hizmeti iptal eden bir **iade**. Hiçbir cron fesih çağırmaz (vade+30 yalnızca aday listesi). Akış: **önce son yedek** (§9.6) → sahiplik işareti kontrolü → `POST …/status/stop` → `DELETE /nodes/{node}/qemu/{vmid}?purge=1&destroy-unreferenced-disks=1` → köprü IP'yi havuza bırakır. VM zaten yoksa başarı sayılır.

### 4.5 Güç işlemleri (müşteri paneli)

| Panel | Modül | PVE |
|---|---|---|
| Başlat | `start` | `status/start` (çalışıyorsa çağrı yok) |
| Durdur | `stop` | `status/shutdown timeout=60 forceStop=1` (düzgün kapatma, 60 sn sonra zorla) |
| — | `shutdown` | `status/shutdown timeout=120` |
| Yeniden başlat | `restart` | `status/reboot` (kapalıysa `start`) |

Bağlı hizmetlerde uzak işlem başarısızsa yerel durum **değişmez** ve müşteriye genel bir hata gösterilir (teknik ayrıntı log'da). Bağsız (eski) hizmetler eskisi gibi çalışır.

### 4.6 Kullanım

`getUsage`: `GET …/status/current` (CPU = vCPU oranı %, RAM, disk boyutu, güç durumu) + `GET …/rrddata?timeframe=month&cf=AVERAGE` (ay başından beri trafik = (netin+netout) bayt/sn × adım). Konuk ajanı olmadan qemu disk doluluğunu bilmez → disk yalnız boyut olarak gösterilir. `refreshServiceUsage` sonuçları `Service.cpuUsage / ramUsage (%) / diskLimit / bandwidthUsed (GB)` alanlarına yazar; müşteri hizmet sayfası 5 dakikada bir (sayfayı en fazla 3 sn bekleterek) ve **Yenile** düğmesiyle (dakikada bir) tazeler. Periyodik bir toplu senkron işi henüz yok.

### 4.7 Konsol (noVNC) — "Yakında"

Güvenli değil, bu yüzden `console` yeteneği **bildirilmedi** ve panelde "Konsol · Yakında" görünür. Sebep: noVNC tarayıcının PVE'ye `vncwebsocket` ile doğrudan bağlanmasını ister; bu bir PVE kullanıcı bileti (cookie) gerektirir. API token'ı tarayıcıya verilemez, token'la tarayıcı bileti üretilemez; müşteriye PVE kullanıcısı açmak ya da PVE'yi müşteriye açmak kabul edilemez. Doğru çözüm: `POST …/vncproxy` (sunucuda) + KLEACORE üzerinden kimlik doğrulamalı, VM'e kilitli bir WebSocket vekili. Ayrı iş olarak bırakıldı.

### 4.8 Yeniden kurulum

Müşteri panelinde sunucu adını (`kc-…`) yazarak onaylar, isteğe bağlı SSH açık anahtarları ekler → `server.reinstall` kuyruğu (3 deneme). Modül: sahiplik kontrolü → dur → `DELETE purge` → **aynı VMID'e** yeniden klon → aynı IP ile yapılandırma (yeni şifre, ilk giriş bilgileri tekrar bir kez gösterilebilir) → başlat. Aşamalar (`queued → destroy → provision → done|failed`) `moduleData`'da tutulur; tekrar deneme silmeyi tekrarlamaz. Son deneme başarısızsa `needsAdmin` notu yazılır.

### 4.9 İlk giriş bilgileri

Müşteri hizmet sayfasında **Bilgileri göster** → onay penceresi → kullanıcı, şifre, IP **bir kez** gösterilir (satır kilitli; `credentialsRevealedAt` damgalanır, `SERVER_CREDENTIALS_REVEALED` etkinliği yazılır). Sonrasında panelden tekrar görülemez; yeniden kurulum yeni şifre üretir. Faturalı askıdaki sunucuda gösterilmez. Yönetim detay sayfası artık `moduleData`'yı tarayıcıya göndermez.

## 5. Kod kuralları

- Modül dosyaları registry/manifests/instances/provisioning import etmez; IPAM ve DB yalnızca fonksiyon içinde dinamik import edilir (`dbIpam`). Testler `createProxmoxModule(instance, { ipam, runtime, generatePassword })` ile bağımlılık verir.
- Sözleşmeye eklenenler (geriye uyumlu): `ServerAccountContext.state` (köprü `Service.moduleData[moduleId]` sağlar), `ServerModule.abandonProvisioning?`, `ServerUsage.powerState?`. Bellek içi durum: `createMemoryModuleState()` (`testing.ts`).

## 6. En az yetkili API token'ı (sahibin yapacağı)

PVE kabuğunda (root SSH veya Datacenter → Shell). Pool kullanarak yetkiyi yalnızca KLEACORE VM'leriyle sınırlayın:

```bash
# 1) Rol (PVE 8/9). PVE 9'da VM.Monitor ayrıcalığı kaldırıldı; pveum "unknown privilege" derse listeden çıkarın.
pveum role add KleacoreVDS -privs "VM.Allocate VM.Clone VM.Audit VM.PowerMgmt VM.Console \
  VM.Config.CPU VM.Config.Memory VM.Config.Disk VM.Config.Network VM.Config.Cloudinit VM.Config.Options \
  VM.Config.CDROM VM.Config.HWType Datastore.AllocateSpace Datastore.Audit Sys.Audit SDN.Use Pool.Audit Pool.Allocate"
#    (PVE 8'de isteğe bağlı olarak VM.Monitor eklenebilir; modül kullanmaz.)

#    Yedekleme (§9) için ayrıca: VM.Backup (vzdump), Datastore.AllocateSpace + Datastore.Audit yedek depolamasında.
#    PVE 9: pveum role modify KleacoreVDS -append 1 -privs "VM.Backup"

# 2) Ayrı kullanıcı + token (privsep=0: token kullanıcının izinlerini taşır, ACL tek yerde)
pveum user add kleacore@pve --comment "KLEACORE otomasyon"
pveum user token add kleacore@pve kleacore --privsep 0 --comment "KLEACORE VDS"
#    → çıktıdaki "value" (UUID) = tokenSecret; bir kez gösterilir.

# 3) Pool ve izinler (yollar DCNET örneği: node adını `pvesh get /nodes` ile kontrol edin)
pveum pool add kleacore --comment "KLEACORE VDS'leri"
pveum acl modify /pool/kleacore            --users kleacore@pve --roles KleacoreVDS   # yeni VM'ler burada
pveum acl modify /vms/9000                 --users kleacore@pve --roles PVETemplateUser # şablonu klonlama (VM.Clone + VM.Audit)
pveum acl modify /storage/local-lvm        --users kleacore@pve --roles PVEDatastoreUser # disk alanı
pveum acl modify /nodes/<node>             --users kleacore@pve --roles PVEAuditor      # node durumu (Sys.Audit)
pveum acl modify /sdn/zones/localnetwork   --users kleacore@pve --roles PVESDNUser      # vmbr0'ı kullanma (PVE 8+)
pveum acl modify /storage/local            --users kleacore@pve --roles PVEDatastoreUser # yedek depolaması (backupStorage / pbsStorage)
```

KLEACORE örneğinde: `tokenId = kleacore@pve!kleacore`, `pool = kleacore`, VMID aralığı mevcut VM'lerle çakışmayan bir blok (ör. 1000–1999). Şablon (9000) pool dışında kalır; yalnızca klonlanabilir. TLS için `/etc/pve/pve-root-ca.pem` içeriğini `caCert` alanına yapıştırın (`verifyTls` açık kalsın).

Not: `/cluster/resources` yalnızca token'ın görebildiği VM'leri listeler; aralıktaki görünmeyen bir VMID'i `/cluster/nextid` yine "dolu" diye reddeder, modül sıradakine geçer.

## 7. DCNET node'u (188.132.235.28, PVE 9.2) ve `kvm: 0`

Node VMware üzerinde iç içe çalışıyor ve **KVM yok**: VM oluşturma/klon/yapılandırma çalışır, başlatma "KVM virtualisation configured, but not available" ile başarısız olur (modül `PROXMOX_START` hatası verir, iş tekrar dener, sonunda IP bırakılır, VM kalır). **Yalnızca test için** örnekte "KVM kapalı (kvm: 0)" açılırsa VM'ler TCG yazılım emülasyonuyla (çok yavaş) açılır. Üretim VDS'lerinde asla açık bırakmayın; elle eşdeğeri `qm set <vmid> --kvm 0`.

## 8. Uçtan uca test planı (izin verildiğinde)

Bu çalışmada gerçek Proxmox'a **hiç istek atılmadı** (token yoktu). Sahip onay verince, test node'unda:

1. §6'daki token'ı oluşturun; KLEACORE'da (staging/yerel) örnek açın → **Bağlantıyı test et** yeşil, sürüm 9.x görünmeli.
2. Ayrı bir test IP havuzu (ör. kullanılmayan 2–3 adres) bağlayın; örnekte `testDisableKvm` açık, VMID aralığı 1900–1909.
3. Test ürünü: `templateVmid=9000`, 1 vCPU, 1024 MB, 12 GB, `osLabel=Ubuntu 22.04`.
4. Test müşterisiyle sipariş + ödeme (sandbox) → `/yonetim/provisioning`'de iş; PVE'de `kc-…` VM (pool `kleacore`, tag `kleacore`, açıklamada işaret), Cloud-Init sekmesinde kullanıcı/IP/DNS, disk 12G, VM çalışıyor (TCG).
5. Devam etme: kurulum sürerken worker'ı durdurup yeniden başlatın → ikinci klon olmamalı.
6. Panel: IP/OS/özellikler, kullanım (birkaç dk sonra **Yenile**), ilk giriş bilgileri bir kez görünür; `ssh kleacore@<ip>` (ağ izin veriyorsa).
7. Güç: Durdur → VM kapanır, durum "Durduruldu"; Başlat; Yeniden başlat.
8. Askı: yönetimden **Askıya al** → VM kapalı, `onboot=0`, müşteri başlatamaz; **Aktif et** → açılır.
9. Paket değişimi: daha büyük pakete geçiş → cores/memory güncel, disk büyür (yeniden başlatmada uygulanır).
10. Yeniden kurulum: panelden onaylı → aynı VMID/IP, yeni şifre bir kez görünür.
11. Hata yolu: `testDisableKvm` kapalıyken yeni sipariş → `PROXMOX_START` hataları, son denemeden sonra IP havuza döner, kartta "VM … bırakıldı" notu; **Proxmox'ta yeniden dene** (kvm açılarak) kaldığı yerden tamamlar.
12. Fesih: hizmeti iptal et → VM silinir (purge), IP havuza döner (bekleme süresiyle).
13. Temizlik: test VM'lerini, pool'u gerekirse token'ı silin.

## 9. Yedekleme (vzdump / PBS) — Faz 4

Kod: modül `createBackup / listBackups / restoreBackup / deleteBackup` (yetenek `backups`), uygulama katmanı `src/lib/backups/` (`policy.ts` saf kurallar, `vds.ts` DB + kuyruk), müşteri `src/components/panel/vds-backups.tsx`, yönetim `src/components/admin/modules/vds-backups-card.tsx`. Testler: `proxmox.backups.test.ts` (sahte PVE), `src/lib/backups/*.test.ts`, `vds.integration.test.ts` (`RUN_DB_TESTS=1`).

### 9.1 Ayarlar

Örnek (`/yonetim/moduller` → Proxmox):

| Alan | Varsayılan | Not |
|---|---|---|
| `backupStorage` | `local` | vzdump arşivlerinin depolaması (içerik türü "VZDump backup file" açık olmalı) |
| `pbsStorage` | — | Doluysa yedekler bu Proxmox Backup Server depolamasına gider (`compress` gönderilmez, PBS kendisi sıkıştırır) |
| `backupMode` | `snapshot` | `snapshot` / `suspend` / `stop` |
| `backupRetention` | 2 | Ürün belirtmezse VDS başına yedek hakkı (son N); 0 = müşteri yedeği yok |
| `manualBackupsPerDay` | 3 | "Şimdi yedek al" günlük sınırı (hizmet başına, `rate_limit_buckets`) |
| `finalBackupKeepDays` | 14 | Fesih öncesi son yedeğin saklama süresi |
| `backupNotifyCustomer` | kapalı | Müşteriye "yedek alındı / alınamadı" e-postası. Hatalar her zaman yöneticiye (`admin.event-alert`) gider |

Ürün seçeneği `backupSlots` (boş = örnek varsayılanı, 0 = yok). **Ek yedek hakkı**: eklenti (ProductAddon) sistemi satın alınan eklentiyi hizmete bağlamıyor (yalnız sipariş satırı JSON'unda), bu yüzden ek hak yönetim hizmet sayfasındaki **Ek yedek hakkı** alanından elle verilir (`moduleData._backups.extraSlots`). Hak = ürün (veya örnek) + ek.

### 9.2 Yedek alma

`Backup` satırı kayıttır (`trigger` MANUAL / SCHEDULED / FINAL, `volid`, `storage`, `node`, `vmid`, `upid`, `size` MB). Her yedek `backup.run` işinde çalışır: **pg-boss `singleton` politikası, anahtar `<örnek>:<node>`** → bir node'da aynı anda tek yedek işi (PVE de vzdump'ı node başına kilitler). Akış: sahiplik işareti kontrolü → `POST /nodes/{node}/vzdump` (`vmid`, `storage`, `mode`, `compress=zstd`, `notes-template=kleacore-backup:<backupId> …`, `remove=0` — depolamanın kendi prune ayarı arşivlerimizi silmesin) → UPID `Backup.upid`'e yazılır → görev beklenir (`taskTimeoutSeconds`) → `GET /nodes/{node}/storage/{storage}/content?content=backup&vmid=` içinde notlardaki etiketle (yoksa görev kaydındaki "creating … archive" satırıyla) arşiv bulunur → `volid` + boyut.
Görev süreyi aşarsa iş `PROXMOX_BACKUP_RUNNING` ile yeniden denenir ve **aynı UPID'i** bekler (20 deneme × ~1 dk + bekleme ≈ 3 saat). Görev hata ile biterse UPID temizlenir, sonraki deneme yeni vzdump başlatır; son denemede `FAILED` + `backup.failed` olayı.

Kurallar: yalnız ACTIVE ve kurulmuş VDS; aynı anda tek yedek; geri yükleme / yeniden kurulum sürerken yedek yok. Manuel yedek boş hak ister; otomatik yedek hak doluysa en eskiyi döndürür. Başarılı yedekten sonra **son N** dışındakiler (en eskiden) `DELETE /nodes/{node}/storage/{storage}/content/{volid}` ile silinir, satıra `deletedAt` yazılır (FINAL yedekler bu budamaya girmez).

### 9.3 Zamanlama

Müşteri VDS sayfası → Yedekler → Otomatik yedekleme: Kapalı / Her gün / Haftada bir + saat penceresi (Türkiye saati, `CRON_TIMEZONE`). `BackupSchedule` hizmet başına bir satır (`frequency`, `hour`, `weekday`, `nextRunAt`). `run-backups` cron'u artık **saatlik (:15)**; vadesi gelen zamanlama `nextRunAt` üzerinde karşılaştır-ve-ayarla ile sahiplenilir ve yedek benzersiz `slotKey = <zamanlamaId>:<slot ISO>` ile açılır → üst üste binen iki cron aynı dilimi iki kez yedekleyemez. Cron ayrıca kuyruğa girememiş (`SCHEDULED`, 20 dk'dan eski) yedekleri yeniden kuyruğa koyar ve süresi dolan son yedekleri siler. Modülsüz (cPanel) zamanlamalar eski yoldan çalışmaya devam eder.

### 9.4 Geri yükleme

Müşteri: yedek satırı → **Geri yükle** → uyarı (sonraki veriler kalıcı silinir) + sunucu adını (`kc-…`) yazarak onay → `backup.restore` işi (hizmet başına exclusive). Modül: arşivin bu VM'e ait olduğunu `volid` içindeki VMID'den doğrular → VM çalışıyorsa `status/stop` → `POST /nodes/{node}/qemu` (`vmid` aynı, `archive=volid`, `force=1`) → görev beklenir (devam ettirilebilir, `restoreUpid`) → VM başlatılır. Sonuç `backup.restored` / `backup.failed (operation=restore)` olayı; müşteri e-postası her zaman, hata yöneticiye de.

### 9.5 Silme

Müşteri kendi MANUAL/SCHEDULED yedeklerini silebilir (sürerken veya geri yüklenirken değil). Arşiv silinemezse satır kalır ve hata gösterilir. Fesih yedekleri müşteriye görünmez.

### 9.6 Fesih öncesi son yedek

`terminateRemoteService` (hizmet iptali, iade) `backups` yetenekli bir VDS'te önce `finalBackupGate`'e sorar:

1. Tamamlanmış (silinmemiş) bir FINAL yedek varsa → VM silinir.
2. Kuyrukta / sürüyorsa → `FINAL_BACKUP_PENDING` (VM'e dokunulmaz).
3. Yoksa veya sonuncusu başarısızsa → yeni FINAL yedek (VM önce düzgün kapatılır, `mode=stop`) kuyruğa alınır → `FINAL_BACKUP_PENDING`.
4. Yedek tamamlanınca `backup.run` → `server.terminate` işini kuyruğa koyar; iş hizmet hâlâ CANCELLED ise kapıdan geçip VM'i siler.
5. Son yedek başarısız olursa VM **silinmez**; yöneticiye uyarı + hizmet kartında not. Yönetim hizmet sayfası → Sunucu yedekleri: **Son yedeği yeniden dene** veya **Yedeksiz sil** (sunucu adını yazarak; `backups.manage` + `services.manage`, etkinlik kaydı `SERVICE_TERMINATED_WITHOUT_FINAL_BACKUP`). `cancelService(id, { skipFinalBackup: true })` aynı atlamayı yapar.
6. Modül kaydı alınamazsa (örnek silinmiş vb.) kapı **silmez** (`FINAL_BACKUP_CHECK_FAILED`).

FINAL yedek `expiresAt = tamamlanma + finalBackupKeepDays` ile saklanır; yönetici **Süreyi değiştir** ile uzatabilir; süre dolunca `run-backups` arşivi siler (`deletedAt`).

### 9.7 Son yedeği yeni bir hizmete geri yükleme (yönetici)

Müşteri iptalden sonra verisini isterse:

1. Müşteriye aynı Proxmox örneğinde yeni bir VDS hizmeti açın (normal sipariş / yönetimden hizmet ekle) ve kurulumun bitmesini bekleyin (yeni VMID + IP).
2. **Eski** hizmetin sayfası → Sunucu yedekleri → son yedek → **Geri yükle** → "Hedef hizmet kimliği"ne yeni hizmetin kimliğini yazın, onay için **yeni** sunucu adını (`kc-…`) yazın.
3. Modül yeni VM'i durdurur, `qmrestore … force=1 unique=1` ile arşivi yeni VMID'e açar (yeni MAC), ardından adı, sahiplik işaretini, `ipconfig0` / DNS / köprü-VLAN'ı **yeni hizmete** göre yeniden yazar ve VM'i başlatır.
4. Sunucu içindeki kullanıcılar, şifreler, SSH anahtarları eski sunucununkidir; cloud-init yapılandırması değiştiği için ilk açılışta ağ yeni IP ile gelir. Panelde "ilk giriş bilgileri" yeni kurulumun şifresini gösterir — müşteriye eski şifresini kullanmasını söyleyin.

Yalnızca aynı örnekteki **aktif** bir VDS'e yapılabilir; farklı örnek/cluster için PVE'de elle `qmrestore` gerekir.

### 9.8 Olaylar ve şablonlar

Olaylar: `backup.completed`, `backup.failed` (`operation` backup/restore), `backup.restored`. Şablonlar (Bildirimler → şablonlar, düzenlenebilir): `service.backup-completed`, `service.backup-failed`, `service.backup-restored`. Yönetim uyarısı: `backup.failed` → `admin.event-alert`.

### 9.9 Yetkiler

Yeni izin `backups.manage` (yalnız ADMIN): yönetimde yedek al / geri yükle / sil, ek hak, son yedek süresi, son yedeği yeniden dene, yedeksiz sil. Müşteri eylemleri sahiplik kontrolüyle (`customerId`) çalışır; FINAL yedekleri göremez.

### 9.10 Uçtan uca test (izin verildiğinde)

Test node'unda: token rolüne `VM.Backup` ekleyin, `local` depolamasında "VZDump backup file" içeriği açık olsun. Test VDS ürününde `backupSlots=2` → panelden **Şimdi yedek al** → `/yonetim/isler`'de `backup.run`, PVE'de Tasks → vzdump, Storage → local → Backups'ta notlu arşiv; üçüncü (otomatik) yedekten sonra en eski silinir. Geri yükleme: dosya oluşturun → geri yükleyin → dosya yok. Fesih: hizmeti iptal edin → önce VM kapanıp yedeklenir, sonra silinir; yönetimde son yedek ve saklama sonu görünür.
