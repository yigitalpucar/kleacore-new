# KLEACORE — WiseCP Tarzı Hosting/Faturalandırma Sistemi
## Master Plan & Durum Raporu

**Tarih:** 17 Haziran 2026  
**Proje:** KLEACORE (Next.js 16, React 19, Prisma 7, PostgreSQL, NextAuth v5)  
**Hedef:** WiseCP benzeri uçtan uca hosting/domain faturalandırma, provisioning ve entegrasyon merkezi

---

## 1. Yönetici Özeti

KLEACORE, Türkçe hosting/domain platformu olarak güçlü bir temel üzerine kurulmuş durumda. Son sprintlerde admin entegrasyon merkezi, Gri Registrar, cPanel/WHM, Virtualizor VPS/VDS, Stripe sepet ödemesi, cron işleri ve affiliate sistemi eklendi.

**Kritik boşluk:** Müşteri panelindeki fatura ödeme ve hizmet yenileme akışları kredi kartında sahte `CC-{timestamp}` ile anında kapanıyor; Stripe ve `fulfillInvoicePayment` pipeline'ına bağlı değil. Bu, production'da ciddi finansal ve provisioning riski oluşturur.

**Strateji:** 4 fazlı yol haritası. Faz 0 (öncelik) tüm ödeme kaynaklarını tek `fulfillInvoicePayment` hattına bağlar, event bus ve webhook dispatch ekler, KDV tutarlılığını sağlar.

---

## 2. Mevcut Durum Denetimi

### 2.1 Tamamlanan Modüller

| Modül | Durum | Dosya/Konum |
|-------|-------|-------------|
| Admin Entegrasyon Merkezi | ✅ Aktif | `/yonetim/entegrasyonlar`, `module-status.ts` |
| Gri Registrar | ✅ API client | `integrations/registrar/providers/gri-*` |
| cPanel/WHM Provisioning | ✅ Client + provider | `provisioning/providers/cpanel-whm*` |
| Virtualizor VPS/VDS | ✅ Client + provider | `provisioning/providers/virtualizor*` |
| Stripe Sepet Ödemesi | ✅ Checkout + webhook | `checkout.ts`, `api/payments/stripe/webhook` |
| Stripe Bakiye Yükleme | ✅ Webhook | `balance-top-up.ts`, `initiateBalanceTopUp` |
| Banka Havalesi (Admin Onay) | ✅ | `admin/invoices.ts` → `fulfillInvoicePayment` |
| Cron (faturalama, gecikme, askıya alma) | ✅ | `api/cron/*`, `lib/cron/jobs/*` |
| Affiliate (%10) | ✅ Komisyon | `lib/affiliate/*` |
| Activity Log | ✅ | `lib/activity-log.ts` |
| API Keys (admin + müşteri) | ✅ | `lib/actions/*/api-keys.ts` |
| Blog / Bilgi Bankası Admin | ✅ | `lib/actions/admin/blog.ts`, `knowledge-base.ts` |
| İptal Talepleri | ✅ | `cancellation-requests` |
| Ödeme Yöntemleri (KK + Havale) | ✅ Müşteri UI | `lib/payments/methods.ts` |

### 2.2 Kritik Eksikler ve Riskler

| # | Sorun | Etki | Öncelik |
|---|-------|------|---------|
| R1 | `payInvoice` KK → sahte `CC-{timestamp}`, fulfillment yok | Ödeme alınmadan fatura kapanır | P0 |
| R2 | `renewService` KK → aynı sahte ödeme | Yenileme bedelsiz uzar | P0 |
| R3 | Outbound webhook URL ayarı var, dispatch kodu yok | Entegrasyonlar tetiklenmez | P0 |
| R4 | `loadBalance()` anında kredi (kanıtsız) | Finansal güvenlik açığı | P1 |
| R5 | Sepet/yenileme `taxRate: 0`, admin fatura `%20` | KDV tutarsızlığı | P1 |
| R6 | Ödeme sonrası askıdan çıkarma yalnızca yenilemede | Suspend edilmiş hizmet ödenince açılmaz | P1 |
| R7 | Yenileme fulfillment'da service extend yok | Admin havale onayı hizmeti uzatmaz | P0 |
| R8 | SSL, e-posta, yedekleme provisioning | UI stub | P2 |
| R9 | Domain transfer otomasyonu | Ticket akışı | P2 |
| R10 | Affiliate payout admin workflow | Model var, UI yok | P2 |
| R11 | iyzico / PayTR | Planlı Faz 1 | P2 |

### 2.3 Ödeme Akışları (Mevcut vs Hedef)

```
MEVCUT (Sepet KK)     → Order PENDING → Stripe → Webhook → fulfillInvoicePayment ✅
MEVCUT (Sepet Havale) → Order PENDING → Admin onay → fulfillInvoicePayment ✅
MEVCUT (Panel KK)   → payInvoice → CC-fake → PAID (fulfillment YOK) ❌
MEVCUT (Yenileme KK)→ renewService → CC-fake → service extend ❌
MEVCUT (Panel Havale)→ PENDING payment → Admin onay → fulfillment (renewal extend YOK) ⚠️
HEDEF (Tüm KK)      → PENDING → Stripe Checkout → Webhook → fulfillInvoicePayment ✅
HEDEF (Tüm Havale)  → PENDING → Admin onay → fulfillInvoicePayment + renewal extend ✅
```

---

## 3. WiseCP Karşılaştırması

| WiseCP Özelliği | KLEACORE Durumu | Faz |
|-----------------|-----------------|-----|
| Modüler entegrasyon merkezi | ✅ Entegrasyonlar sayfası | — |
| Domain registrar modülleri | ✅ Gri (WiseCP uyumlu API) | — |
| cPanel/WHM auto-provision | ✅ Provider hazır | — |
| VPS panel (Virtualizor) | ✅ Provider hazır | — |
| Çoklu ödeme gateway | ⚠️ Yalnızca Stripe | Faz 1 (iyzico/PayTR) |
| Unified payment fulfillment | ❌ Panel/yenileme kopuk | **Faz 0** |
| Otomatik askıya alma/çıkarma | ⚠️ Askıya alma var, çıkarma eksik | **Faz 0** |
| KDV / vergi motoru | ❌ Tutarsız | **Faz 0** |
| Outbound webhooks | ❌ Ayar var, dispatch yok | **Faz 0** |
| E-fatura / e-arşiv | ❌ | Faz 1 |
| SMS bildirimleri | ❌ | Faz 1 |
| Konfigürasyonlu ürün | ⚠️ Kısmi | Faz 2 |
| Upgrade/downgrade | ⚠️ Admin UI var | Faz 2 |
| SSL otomatik provisioning | ❌ | Faz 2 |
| Bayilik / reseller | ⚠️ Affiliate var | Faz 3 |
| Marketplace / SDK | ❌ | Faz 3 |

---

## 4. Mimari Hedef (Faz 0)

```
┌─────────────────────────────────────────────────────────────┐
│                    Müşteri / Admin UI                        │
│  Sepet │ Panel Fatura │ Yenileme │ Admin Havale Onayı       │
└────────────┬────────────────────────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────────────────────────┐
│              PaymentOrchestrator (src/lib/payments/)         │
│  initiatePayment() → BANK_TRANSFER | STRIPE_CHECKOUT        │
└────────────┬───────────────────────────────┬────────────────┘
             │                               │
    PENDING payment                   Stripe Session
             │                               │
             ▼                               ▼
┌────────────────────┐          ┌──────────────────────────┐
│ Admin approve      │          │ Stripe Webhook           │
│ (bank transfer)    │          │ checkout.session.completed│
└─────────┬──────────┘          └────────────┬─────────────┘
          │                                   │
          └──────────────┬────────────────────┘
                         ▼
          ┌──────────────────────────────────┐
          │     fulfillInvoicePayment()       │
          │  • invoice PAID                   │
          │  • order COMPLETED                │
          │  • provisionCompletedOrder()      │
          │  • applyRenewalIfNeeded()  [NEW]  │
          │  • unsuspendService()      [NEW]  │
          │  • applyAffiliateCommission()     │
          └──────────────┬───────────────────┘
                         ▼
          ┌──────────────────────────────────┐
          │     EventDispatcher [PR-2]        │
          │  order.paid | payment.completed   │
          │  → outbound webhooks              │
          │  → activity log                   │
          └──────────────────────────────────┘
```

---

## 5. Entegrasyon Modül Envanteri

| ID | Modül | Provider | Config Keys |
|----|-------|----------|-------------|
| registrar | Domain Registrar | gri | `registrar_*` |
| cpanel | Hosting/E-posta | cpanel-whm | `cpanel_*` |
| vps-vds | VPS/VDS/Sunucu | virtualizor | `vps_vds_*` |
| stripe | Ödeme (KK) | stripe | `STRIPE_*` env |
| smtp | E-posta | smtp/nodemailer | `smtp_*` / env |
| webhooks | Outbound | custom | `webhook_orders`, `webhook_payments` |
| api | REST API v1 | builtin | API keys |
| cron | Zamanlanmış | vercel/cron | `CRON_SECRET` |

---

## 6. Faz Planı

### Faz 0 — Ödeme & Olay Altyapısı (2-3 hafta)

- PR-1: Payment Orchestrator + panel Stripe
- PR-2: Event Dispatcher + outbound webhook
- PR-3: KDV motoru + auto-unsuspend
- PR-4: Provisioning retry queue

### Faz 1 — Türkiye Ödeme & Bildirim (3-4 hafta)

- iyzico / PayTR modülü (entegrasyon merkezine kart)
- SMS (Netgsm / İleti Merkezi)
- E-fatura / e-arşiv taslağı
- Domain transfer Gri API otomasyonu
- `loadBalance()` kaldır / yalnızca Stripe top-up

### Faz 2 — Ürün & Hizmet Derinleştirme (4-6 hafta)

- Konfigürasyonlu ürün wizard
- Upgrade/downgrade otomasyonu
- SSL provisioning (Let's Encrypt / Sectigo API)
- E-posta hesabı provisioning (cPanel)
- Yedekleme entegrasyonu

### Faz 3 — İş Geliştirme (6+ hafta)

- Ön muhasebe raporları
- Bayilik / reseller panel
- Affiliate payout workflow
- Marketplace / public SDK genişletme

---

## 7. Test Kriterleri (Faz 0)

| Senaryo | Beklenen |
|---------|----------|
| Panel fatura KK | Stripe redirect → webhook → PAID + provision |
| Panel fatura havale | PENDING → admin onay → PAID + provision |
| Yenileme KK | Stripe → webhook → service extend + unsuspend |
| Yenileme havale | Admin onay → service extend |
| Sepet KK (regresyon) | Mevcut akış bozulmamalı |
| Stripe idempotency | Aynı event 2x → tek fulfillment |
| Outbound webhook | `payment.completed` POST → URL |
| KDV | Sepet ve panel aynı `tax_rate` ayarı |

---

## 8. Ajan Yürütme Sırası

```
Ajan-1 (PR-1) → Ajan-2 (PR-2) → Ajan-3 (PR-3) → Ajan-4 (PR-4)
     │                │               │
     └─ bağımlılık ───┴───────────────┘
```

Her PR sonrası: `pnpm typecheck` + `pnpm test` zorunlu.

---

## PR Plan

### PR 1: Unified Payment Orchestrator

- **Description:** Tüm müşteri ödeme girişlerini tek orchestrator'a bağla. Panel fatura ve hizmet yenileme KK ödemelerini gerçek Stripe Checkout'a yönlendir. `fulfillInvoicePayment` içine yenileme uzatma mantığı ekle.
- **Files/components affected:** `src/lib/payments/orchestrator.ts`, `src/lib/payments/fulfillment.ts`, `src/lib/actions/customer/invoices.ts`, `src/lib/actions/customer/services.ts`, `src/app/musteri/panel/faturalar/[id]/content.tsx`, `src/app/musteri/panel/hizmetlerim/[id]/yenile/content.tsx`
- **Dependencies:** None

### PR 2: Event Dispatcher & Outbound Webhooks

- **Description:** `order.paid`, `payment.completed`, `service.renewed` olaylarını dispatch et. Admin ayarındaki `webhook_orders` ve `webhook_payments` URL'lerine HMAC imzalı POST gönder.
- **Files/components affected:** `src/lib/events/dispatcher.ts`, `src/lib/events/types.ts`, `src/lib/integrations/webhooks/outbound.ts`, `src/lib/payments/fulfillment.ts`, `src/lib/activity-log.ts`
- **Dependencies:** PR 1

### PR 3: KDV Tutarlılığı & Auto-Unsuspend

- **Description:** `billing.tax_rate` ayarını tüm checkout/yenileme/cron faturalarına uygula. Ödeme sonrası `SUSPENDED` hizmetleri otomatik `ACTIVE` yap.
- **Files/components affected:** `src/lib/billing/tax.ts`, `src/lib/actions/customer/checkout.ts`, `src/lib/actions/customer/services.ts`, `src/lib/cron/jobs/generate-renewal-invoices.ts`, `src/lib/payments/fulfillment.ts`
- **Dependencies:** PR 1

### PR 4: Provisioning Retry Queue

- **Description:** Başarısız provisioning için DB kuyruğu + cron retry job. Admin panelde başarısız provisioning listesi.
- **Files/components affected:** `prisma/schema.prisma`, `src/lib/provisioning/retry-queue.ts`, `src/app/api/cron/retry-provisioning/route.ts`, `src/lib/provisioning/internal.ts`
- **Dependencies:** PR 1

---

## 9. Ortam & Kurulum

```bash
cp .env.example .env
# DATABASE_URL, NEXTAUTH_*, STRIPE_*, CRON_SECRET
pnpm install
pnpm db:migrate:deploy
pnpm dev
```

Cron (Vercel): `vercel.json` içinde tanımlı `/api/cron/*` endpoint'leri.

---

## 10. Faz 0 Uygulama Durumu (17 Haziran 2026)

| PR | Durum | Özet |
|----|-------|------|
| PR-1 | ✅ Tamamlandı | Payment Orchestrator, panel fatura/yenileme → Stripe Checkout |
| PR-2 | ✅ Tamamlandı | Event dispatcher + outbound webhook (HMAC imzalı) |
| PR-3 | ✅ Tamamlandı | KDV motoru (`billing.tax_rate`) + auto-unsuspend |
| PR-4 | ✅ Tamamlandı | ProvisioningJob kuyruğu + cron retry (15 dk) |

**Doğrulama:** `pnpm typecheck` ✅ · `pnpm test` 51/51 ✅

**Deploy öncesi:** `pnpm db:migrate:deploy` (ProvisioningJob migration)

---

## 11. Faz 1 Uygulama Durumu (17 Haziran 2026)

| PR | Durum | Özet |
|----|-------|------|
| PR-5 | ✅ | `loadBalance()` kaldırıldı, bakiye yalnızca Stripe top-up |
| PR-6 | ✅ | iyzico + PayTR gateway modülü, orchestrator + callback route'ları |
| PR-7 | ✅ | SMS (Netgsm / İleti Merkezi), ödeme + gecikmiş fatura bildirimi |
| PR-8 | ✅ | E-Fatura/E-Arşiv UBL-TR draft + `/yonetim/efatura` listesi |
| PR-9 | ✅ | Domain transfer Gri API otomasyonu + sipariş/fatura akışı |

**Doğrulama:** `pnpm typecheck` ✅ · `pnpm test` 68/68 ✅

**Deploy öncesi migration'lar:**
```bash
pnpm db:migrate:deploy   # ProvisioningJob + EInvoiceRecord
```

**Yeni admin konumları:**
- Entegrasyonlar → Ödeme: Stripe / iyzico / PayTR seçici
- Entegrasyonlar → SMS: Netgsm / İleti Merkezi
- Entegrasyonlar → E-Fatura: mock/paraşüt taslağı
- Faturalar → E-Fatura / E-Arşiv listesi

---

## 12. Faz 2 Uygulama Durumu (17 Haziran 2026)

| PR | Durum | Özet |
|----|-------|------|
| PR-10 | ✅ | `ProductConfigOption` + hosting wizard yapılandırma adımı + checkout |
| PR-11 | ✅ | `ServicePlanChange` + müşteri yükselt/düşür + cPanel changepackage |
| PR-12 | ✅ | SSL provisioning (mock/LE/Sectigo) + expiry cron |
| PR-13 | ✅ | cPanel e-posta hesabı CRUD + `/hizmetlerim/[id]/eposta` |
| PR-14 | ✅ | cPanel/mock backup + scheduled backup cron (03:00) |

**Doğrulama:** `pnpm typecheck` ✅ · `pnpm test` 99/99 ✅

**Deploy migration'lar:**
```bash
pnpm db:migrate:deploy
# product_config_options, service_plan_changes, service_email_accounts
```

**Yeni müşteri konumları:**
- Hizmet detay → Paket Değiştir (`/yukselt`)
- Hosting hizmet → E-posta Hesapları (`/eposta`)
- Hosting satın al → Yapılandırma adımı (opsiyon varsa)

---

## 13. Faz 3 Uygulama Durumu (17 Haziran 2026)

| PR | Durum | Özet |
|----|-------|------|
| PR-15 | ✅ | Ön muhasebe raporları (KDV, defter, tahsilat) + Muhasebe sekmesi |
| PR-16 | ✅ | Bayilik paneli + admin bayi yönetimi + checkout indirimi |
| PR-17 | ✅ | Affiliate payout talep/onay/tamamlama workflow |
| PR-18 | ✅ | API v1 genişletme (services/orders/domains) + OpenAPI + SDK |

**Doğrulama:** `pnpm typecheck` ✅ · `pnpm test` 122/122 ✅

**Deploy migration'lar:**
```bash
pnpm db:migrate:deploy
# reseller_fields, affiliate_payment_fields
```

**Yeni konumlar:**
- Admin: Raporlar → **Muhasebe** | Müşteriler → **Bayiler** | **Affiliate Ödemeleri**
- Müşteri: **Bayilik** paneli (reseller hesaplar) | Satış Ortaklığı → ödeme talebi
- API: `/api/v1/services`, `/orders`, `/domains`, `/api/v1/openapi`
- SDK: `src/lib/sdk/kleacore-client.ts`

---

## 14. Production Hazırlık (17 Haziran 2026)

| Kontrol | Durum |
|---------|-------|
| Migration deploy | ✅ 15 migration uygulandı |
| Production build | ✅ |
| Test suite | ✅ 122/122 |
| `/giris` redirect | ✅ `next.config.mjs` → `/musteri/giris` |
| Cron smoke (6 endpoint) | ✅ `CRON_SECRET` ile 200 |
| Auth smoke | ✅ `scripts/smoke-auth.mjs` (seed kullanıcıları) |
| Smoke test raporu | ✅ `docs/QA-SMOKE-REPORT.md` |
| Deploy checklist | ✅ `docs/DEPLOY-CHECKLIST.md` |

**Staging'de kalan manuel testler:** Stripe sepet/webhook, iyzico/PayTR callback, Gri domain transfer, affiliate onay akışı.

---

*Bu belge canlıdır; her PR tamamlandıkça güncellenir.*