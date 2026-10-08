# Modül kaydı, modül örnekleri ve IP havuzları (Faz 2.1 / 2.2 / 2.4)

Bu belge, yeni bir modülün (Proxmox, Cloudflare DNS, …) nasıl yazılacağını ve mevcut sistemin nasıl bağlandığını anlatır. Kod: `src/lib/modules/**`, `src/lib/ipam/**`. Yönetim ekranları: `/yonetim/moduller`, `/yonetim/ip-havuzlari`, ürün düzenleme → **Otomasyon**, hizmet detayı → **Otomasyon modülü**.

## 1. Kavramlar

| Kavram | Nerede | Ne |
|---|---|---|
| **Manifest** | `src/lib/modules/<kind>/<id>/index.ts` | Modül tipi: `id`, `kind`, `configSchema` (zod), `secretFields`, `capabilities`, `healthCheck`, `create()` (sözleşme fabrikası), sunucu modüllerinde `productOptionsSchema`. |
| **Kayıt (registry)** | `src/lib/modules/manifests.ts` → `registry.ts` | Tüm manifest'ler. Açılışta doğrulanır (`validateManifest`); bozuk manifest uygulamayı başlatmaz. |
| **ModuleInstance** | Prisma `module_instances` | Bir manifest'in yapılandırılmış kopyası ("WHM 188.132.235.10", "PVE DCNET"). `config` JSON; gizli alanlar `enc:v1:` ile şifreli (`src/lib/secrets/crypto.ts`, `ENCRYPTION_KEY`). |
| **Sözleşme (contract)** | `src/lib/modules/contracts.ts` | Tür başına tipli arayüz: `ServerModule`, `RegistrarModule`, `DnsModule`, `PaymentModule`, `EInvoiceModule`, `SmsModule`, `MailModule`, `StorageModule`. |
| **Ürün bağı** | `Product.moduleInstanceId` + `Product.moduleOptions` | Ürün hangi örnekte, hangi seçeneklerle (WHM paketi, Proxmox şablonu …) açılır. |
| **Hizmet bağı** | `Service.moduleInstanceId` + `Service.remoteId` | Hesabın yaşadığı örnek ve oradaki kimliği (WHM kullanıcı adı / Proxmox VMID). `Service.serverName` yalnızca geçmiş için tutulur. |

`ModuleKind`: `payment | registrar | server | dns | sms | mail | einvoice | storage` (Prisma enum ile aynı değerler).

## 2. Yeni modül yazmak

### 2.1 Dosyalar

```
src/lib/modules/<kind>/<id>/index.ts          # manifest + sözleşme
src/lib/modules/<kind>/<id>/client.ts         # (ops.) HTTP istemcisi
src/lib/modules/<kind>/<id>/<id>.contract.test.ts
src/lib/modules/<kind>/<id>/__fixtures__/*.json
```

Kayıt: `src/lib/modules/manifests.ts` içine **bir import + bir satır** ekleyin (paralel dallar kolay birleşsin diye her modül tek satır).

**İçe aktarma kuralı (döngü olmasın):** modül dosyaları `registry.ts`, `manifests.ts`, `instances.ts`, `provisioning.ts` dosyalarını **import etmez**. Kullanabilecekleri: `../../types`, `../../contracts`, `../../product-options`, `../legacy-adapter`, `@/lib/integrations/**` istemcileri, `@/lib/ipam` (yalnızca fonksiyon içinde çağırarak).

### 2.2 Asgari örnek (bellek içi DNS — `src/lib/modules/examples/memory-dns.ts`)

```ts
import { z } from "zod";
import type { DnsModule } from "../contracts";
import { defineModule, type ResolvedModuleInstance } from "../types";

export const configSchema = z.object({
  apiToken: z.string().min(1),                                   // gizli → secretFields
  nameservers: z.array(z.string().min(1)).min(1).default(["ns1.example.test", "ns2.example.test"]),
  defaultTtl: z.coerce.number().int().min(1).max(86400).default(300),
});
type Config = z.infer<typeof configSchema>;

function create(instance: ResolvedModuleInstance<Config>): DnsModule {
  return {
    moduleId: "memory-dns",
    async ensureZone(zone) { /* … */ return { ok: true, data: { zoneId: zone, nameservers: instance.config.nameservers, created: true } }; },
    async listRecords(zone) { /* … */ },
    async upsertRecord(zone, record) { /* … */ },
    async deleteRecord(zone, id) { /* … */ },
  };
}

export const memoryDnsModule = defineModule({
  id: "memory-dns",                       // kebab-case, ModuleInstance.moduleId'de saklanır, değiştirmeyin
  kind: "dns",
  name: "Bellek içi DNS (örnek)",
  description: "…",
  configSchema,
  secretFields: ["apiToken"],
  configFields: { apiToken: { label: "API token" }, nameservers: { label: "Ad sunucuları" } },
  capabilities: ["zones", "records"],
  async healthCheck(instance) { return { ok: true, message: "Hazır" }; },   // ASLA throw etmez
  create,
});
```

### 2.3 Manifest kuralları

- `configSchema` bir `z.object` olmalı. Varsayılanları `.default()` ile verin; isteğe bağlı alanlar `.optional()`. Sayılar formdan metin gelir → `z.coerce.number()`.
- `secretFields`: şifreli saklanır, yönetim ekranında `********` gösterilir; boş/maske bırakılırsa mevcut değer korunur. Gizli alanı log'a, `ActivityLog`'a, hata mesajına yazmayın.
- `configFields` / `productOptionsFields`: Türkçe etiket, ipucu, `placeholder`, `optionLabels` (z.enum), `multiline` (SSH anahtarı gibi). Form bunlardan **otomatik** üretilir (`schema-form.ts` → `components/admin/modules/schema-fields.tsx`). Desteklenen tipler: string (url/email), number (int/min/max), boolean, enum, `z.array(z.string())` (satır/virgül listesi).
- `capabilities`: isteğe bağlı her metot için yetenek bildirilmeli, bildirilen her yeteneğin metodu olmalı (sözleşme testi kontrol eder):
  - server: `usage→getUsage`, `sso→getSsoUrl`, `console→getConsoleUrl`, `power→powerAction`, `reinstall→reinstall`, `listAccounts→listAccounts`; `provision`, `changePackage`, `ipam` bilgi amaçlı.
  - registrar: `bulkAvailability→checkDomainsAvailability`, `tldPricing→fetchTldPricing`, `listDomains`, `eppCode→getEppCode`, `lock→setLock`.
- `healthCheck(instance)`: "Bağlantıyı test et". Hata → `{ ok: false, message }`; 15 sn zaman aşımı kayıt katmanında. Sonuç `lastHealthAt/lastHealthStatus/lastHealthError` olarak saklanır.
- `hidden: true`: dondurulmuş modül (Virtualizor, Stripe) — yeni örnek açılamaz, mevcut örnekler çalışır.
- `storage: "settings"` + `settingsHref`: ayarları hâlâ `Setting` tablosunda olan modüller (ödeme, e-fatura, SMS). Modüller ekranında listelenir ve test edilir, örnek açılmaz.
- Sunucu modülleri: `productCategories` (hangi kategorideki ürünler bağlanabilir: `hosting`, `email`, `vds`, `vps`, `server`, `cloud` …) ve `productOptionsSchema`.

### 2.4 Sözleşmeler (özet — ayrıntı `contracts.ts`)

Genel: uzak çağrılar **asla throw etmez**, `IntegrationResult` döner (`{ ok, error?, skipped?, reference?, data? }`). `skipped: true` = "desteklenmiyor / yapılandırılmamış, hiçbir şey yapılmadı" — çağıranlar bunu başarı sayar, gerçek hata için **kullanmayın**.

**ServerModule** (`ServerAccountContext` = `{ instance, service, options }`; `options` ürünün `moduleOptions`'ının şemadan geçmiş hali):

| Metot | Not |
|---|---|
| `createAccount(ctx)` | `data.remoteId` zorunlu (WHM kullanıcı adı / VMID). `ipAddress`, `username`, `password`, `hostname` opsiyonel. Köprü `Service.moduleInstanceId/remoteId/ipAddress`'i kendisi yazar. |
| `suspend(ctx, reason?)`, `unsuspend(ctx)` | `ctx.service.remoteId` üzerinden. |
| `terminate(ctx)` | Geri alınamaz. Başarıdan sonra köprü hizmetin IP'lerini `releaseIp` ile havuza bırakır. |
| `changePackage(ctx)` | `ctx.options` **yeni** ürünün seçenekleri. Farklı modül tipine geçiş köprüde reddedilir (`MODULE_MISMATCH`). |
| `getUsage?`, `getSsoUrl?(ctx, "panel"\|"webmail")`, `getConsoleUrl?`, `powerAction?(ctx, "start"\|"stop"\|"restart"\|"shutdown")`, `reinstall?(ctx, { templateId?, password?, sshKeys? })`, `listAccounts?()` | Yetenek bildirerek. |

**RegistrarModule** = mevcut `RegistrarProvider` + zorunlu `getDomainInfo` + `listDomains?`, `getEppCode?`, `setLock?`.

**DnsModule**: `ensureZone(zone)` (idempotent, `{ zoneId, nameservers, created }`), `listRecords`, `upsertRecord(zone, record)`, `deleteRecord(zone, id)` (olmayan kayıt silmek = ok). `name` tam nitelikli, küçük harf, sonda nokta yok (`www.ornek.com.tr`, apex = `ornek.com.tr`). `upsertRecord` id'siz çağrıldığında: CNAME için aynı tip+ad güncellenir; diğer tiplerde aynı tip+ad+içerik güncellenir (TTL/öncelik/proxy), yoksa oluşturulur.

### 2.5 Sözleşme testleri

Paylaşılan yardımcı: `src/lib/modules/testing.ts`. Hiçbir test gerçek sisteme gitmez: `createFetchMock` eşleşmeyen her isteği hata ile durdurur.

```ts
// src/lib/modules/server/proxmox/proxmox.contract.test.ts
process.env.ENCRYPTION_KEY = "test-encryption-key-test-encryption-key";
import { afterEach, describe, expect, it } from "vitest";
import { createFetchMock, describeModuleContract, makeServerContext, makeTestInstance, restoreFetch } from "../../testing";
import { proxmoxModule, createProxmoxModule } from ".";

const config = { apiUrl: "https://pve.test:8006", tokenId: "root@pam!kleacore", tokenSecret: "pve-secret-123", node: "pve" };

describeModuleContract(proxmoxModule, {
  config,
  productOptions: { templateVmid: 9000, cores: 2, memoryMB: 2048, diskGB: 40, storage: "local-lvm", bridge: "vmbr0" },
  invalidProductOptions: { cores: 0 },
});

describe("proxmox behaviour", () => {
  afterEach(() => restoreFetch());
  it("clones the template", async () => {
    const { calls } = createFetchMock([
      { method: "POST", url: "https://pve.test:8006/api2/json/nodes/pve/qemu/9000/clone", json: { data: "UPID:…" } },
      { url: /\/tasks\/.*\/status$/, json: { data: { status: "stopped", exitstatus: "OK" } } },
    ]);
    const instance = makeTestInstance(proxmoxModule, config);
    const result = await createProxmoxModule(instance).createAccount(makeServerContext(instance, { templateVmid: 9000 }));
    expect(result.ok).toBe(true);
    expect(calls[0].headers.get("authorization")).toBe("PVEAPIToken=root@pam!kleacore=pve-secret-123");
  });
});
```

`describeModuleContract(manifest, { config, productOptions?, invalidProductOptions?, skipUnreachable? })` şunları kontrol eder: manifest geçerli; config şifreli gidiş-dönüş (gizli değer düz metin saklanmaz, maskelenir); boş config zorunlu alan varsa reddedilir; form tanımı üretilir ve gizli alanlar `secret` tipinde; ürün seçenekleri doğrulanır; bildirilen yetenekler ↔ metotlar; API'ye ulaşılamazken `healthCheck` ve tüm sözleşme metotları **throw etmeden** `ok: false` döner.

DNS modülleri ek olarak `describeDnsModuleBehaviour(name, () => module)` ile davranış setini (idempotent zone, upsert eşleşme kuralı, idempotent silme) durum tutan bir sahte arka uca karşı çalıştırmalı (örnek: `examples/memory-dns.contract.test.ts`).

Diğer yardımcılar: `makeTestInstance(manifest, config, overrides?)`, `makeServerContext(instance, options, serviceOverrides?)`, `createUnreachableFetch()`, `assertModuleContract(manifest, contract)`, `assertConfigRoundTrip(manifest, config)`.

## 3. Kayıt API'si (sunucu tarafı)

```ts
import { getModule, listModules, getModuleOfKind, parseProductOptions } from "@/lib/modules/registry";
import { getInstance, listActiveInstances, resolveInstanceForProduct, runHealthCheck, createContract, saveModuleInstance } from "@/lib/modules/instances";

const manifest = getModule("cpanel-whm");                 // manifest | undefined
listModules("server");                                     // görünür sunucu modülleri (includeHidden ile tümü)
const instance = await getInstance(id);                    // config çözülmüş + doğrulanmış; geçersizse ModuleConfigError
const dns = createContract(instance!, "dns");              // tipli DnsModule
await resolveInstanceForProduct(product);                  // ürünün kurulacağı örnek | null
await runHealthCheck(instance!);                           // sonuç satıra yazılır, throw etmez
```

`resolveInstanceForProduct`: ürün tek bir örneğe bağlanır. Örneğin `groupKey`'i varsa aynı tür + modül + grup içindeki **aktif** örnekler havuzdur; en az dolu olan seçilir (yük = PENDING/ACTIVE/SUSPENDED hizmet sayısı; `capacity` varsa yük/kapasite oranı, dolu örnek atlanır), eşitlikte `priority` (küçük önce) sonra eski olan. Grupsuz ürün bağlı örneğe gider (aktif ve dolu değilse). Gruptaki tüm örneklere kapasite verin ki oranlar anlamlı olsun.

`isActive=false`: yeni hizmet açılmaz; o örnekteki **mevcut** hizmetlerin askı/kapama/paket işlemleri sürer.

## 4. Provisioning akışı (2.2)

1. Ödeme transaction'ı (`prepareOrderProvisioning`): ürün bağlı değilse **eski kurallar aynen** (kategori → Settings'teki WHM/VPS ya da `manual_provisioning_categories` → MANUAL görev). Bağlıysa `planProductProvisioning`: kullanılabilir örnek varsa hizmet `moduleInstanceId` ile ACTIVE açılır ve PROVISION işi kuyruğa girer (bağ, `manual_provisioning_categories`'i geçersiz kılar — VDS ürününü Proxmox'a bağlamak otomasyonu açar); yoksa MANUAL görev açılır.
2. `provisioning.run` işi → `createRemoteService` → `getProvisioningProviderForService(service)`: `service.moduleInstanceId` doluysa modül köprüsü (`server-bridge.ts`), değilse eski sağlayıcı. Köprü `ProvisioningProvider` arayüzünü uygular; askı cron'u, iade, paket değişimi, müşteri güç düğmeleri değişmeden çalışır.
3. Bağlı örnek silinmiş/ayarı bozuk/ürün seçenekleri geçersizse işlemler `ok: false` (asla `skipped`) döner → iş FAILED, `/yonetim/provisioning`'de görünür.

Eski (modül öncesi) bir hizmeti örneğe bağlamak: hizmet detayı → **Otomasyon modülü** → örnek + uzak kimlik (WHM kullanıcı adı). Uzak tarafta hiçbir şey değişmez.

## 5. Eski ayarların taşınması (karar)

- **cPanel/WHM, Gri, Virtualizor** → `ModuleInstance` "aynası" (`legacySource` = `cpanel` | `registrar` | `vps_vds`). Taşıma **SQL migration değil, idempotent uygulama kodu** (`src/lib/modules/legacy.ts`), çünkü: gizli ayarlar `ENCRYPTION_KEY` ile şifreli ve production'da WHM/Gri bilgileri env değişkenlerinden (CPANEL_*, REGISTRAR_*) geliyor; etkin ayarı yalnızca uygulama okuyabilir.
  - Çalıştırma: `/yonetim/moduller` → **Eski ayarları içe aktar** (production'da shell gerekmez) veya lokal `pnpm modules:sync-legacy` (`--verify` sadece karşılaştırır). Entegrasyonlar'daki cPanel / registrar / VPS formu her kaydedildiğinde ilgili ayna da güncellenir (tek yön: Settings → örnek). Aynanın bağlantı ayarları Modüller ekranında salt okunurdur; **Entegrasyonlar bağlantısını kopar** ile bağımsız hale gelir.
  - Güvenlik: aynalar mevcut trafiğe dokunmaz. Bağsız ürünler ve tüm registrar çağrıları (`getRegistrarProvider`) Settings'ten okumaya devam eder; ayna yalnızca bir ürün ona bağlandığında kullanılır. `verifyLegacyModuleInstances()` (buton ve betik bunu çalıştırır) her aynadan yeniden kurulan sağlayıcı ayarının Settings ile **alan alan eşit** olduğunu doğrular (yalnızca alan adlarını raporlar, değerleri değil). Test: `legacy.test.ts`.
  - WHM aynası, `Server` tablosunda hostname/IP'si eşleşen satırları da örneğe bağlar.
- **Ödeme (Kuveyt Türk, PayTR, iyzico, Stripe-gizli), e-fatura (Uyumsoft, Paraşüt), SMS (NetGSM, İleti Merkezi)**: manifest olarak kayıtlı (`storage: "settings"`), ayarları **yerinde** kalır. Sebep: checkout, callback, iade ve e-fatura kuyruğu bu ayarları okuyor, çoklu ödeme yöntemi zaten `payment_methods` ile çalışıyor; taşımak canlı ödeme riskine değmez. Taşınmaları ayrı bir adım.

## 6. IP havuzları (2.4)

`src/lib/ipam`: IPv4, en fazla /20 (4096 adres) blok. Havuz oluşturulurken her adres bir satır olur; ağ, yayın (≤/30) ve ağ geçidi eklenmez, "ayrılmış aralıklar" `RESERVED` olur. Adres global olarak tekildir (aynı IP iki havuzda olamaz; çakışan havuz reddedilir).

```ts
import { allocateIp, releaseIp, listPoolsForInstance } from "@/lib/ipam";

const [pool] = await listPoolsForInstance(ctx.instance.id);       // örneğe bağlı havuzlar
const ip = await allocateIp(pool.id, ctx.service.id);             // { address, … } — IpamError("POOL_EXHAUSTED") dolu ise
// … VM'i ip.address / pool.gateway / pool.prefix / pool.dnsServers ile yapılandır …
return { ok: true, data: { remoteId: String(vmid), ipAddress: ip.address } };
```

- `allocateIp(poolId, serviceId, { tx? })`: en küçük boş adres; `SELECT … FOR UPDATE SKIP LOCKED` + `status = FREE` koşullu güncelleme ile **iki hizmete aynı IP asla verilmez**; hizmet başına advisory lock ile idempotent (aynı hizmete aynı adres döner — işi yeniden denemek güvenli). `createAccount` başarısız olursa adresi geri bırakmak modülün işidir (`releaseIp(serviceId)`).
- `releaseIp(serviceId)`: hizmetin tüm adreslerini boşaltır; havuzun `releaseCooldownMinutes` süresi boyunca adres yeniden verilmez. Fesihte köprü otomatik çağırır.
- Yönetim: `/yonetim/ip-havuzlari` (doluluk), havuz detayında elle atama (hizmet no / alan adı / kullanıcı adı / uzak kimlik), serbest bırakma, ayırma.
- Test: `src/lib/ipam/cidr.test.ts`, `ipam.integration.test.ts` (`pnpm test:db`; 39 eşzamanlı istek / 26 adres, tekrar atama yok).

## 7. Paralel ajanlar için notlar

- **Proxmox** (`server/proxmox`): `productCategories: ["vds","vps","server","cloud"]`, `productOptionsSchema` (templateVmid, cores, memoryMB, diskGB, storage, bridge, ipPoolId?), yetenekler `power`, `console`, `reinstall`, `usage`, `ipam`, `listAccounts`. IP için §6. Gerçek PVE'de hiçbir şey oluşturmayın; fixture kullanın.
- **Cloudflare DNS** (`dns/cloudflare`): **yapıldı** — ayrıntı `docs/dns-cloudflare.md`. Sözleşmeye isteğe bağlı `deleteZone` (yetenek `deleteZone`) ve `DnsZoneInfo.status` eklendi. Alan adı tarafı `src/lib/dns/zones.ts` (`ensureDomainZone`, `saveZoneRecord`, `syncZoneMirror`).
- **cPanel SSO / kullanım** (`server/cpanel-whm`): `getSsoUrl` (+ `sso`) ve `getUsage` (+ `usage`) ekleyin; manifest'in `capabilities` listesini güncellemezseniz sözleşme testi kırılır. Legacy hizmetler için önce hizmeti örneğe bağlamak gerekir (§4).
- **İçe aktarma**: `listAccounts` (server) / `listDomains` (registrar) ekleyin; içe aktarılan hizmete `moduleInstanceId` + `remoteId` yazın.
