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

Yalnızca açık yönetici işlemiyle çalışır: hizmet detayı → **Hizmeti iptal et** (onay metni VM'in kalıcı silineceğini söyler) veya hizmeti iptal eden bir **iade**. Hiçbir cron fesih çağırmaz (vade+30 yalnızca aday listesi). Akış: sahiplik işareti kontrolü → `POST …/status/stop` → `DELETE /nodes/{node}/qemu/{vmid}?purge=1&destroy-unreferenced-disks=1` → köprü IP'yi havuza bırakır. VM zaten yoksa başarı sayılır. Fesih öncesi vzdump yedeği (yol haritası 2.3 notu) henüz yok.

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
