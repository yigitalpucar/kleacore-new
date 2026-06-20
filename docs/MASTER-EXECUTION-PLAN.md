# KLEACORE — Master Execution Plan

**Tarih:** 17 Haziran 2026  
**Hedef:** Production-ready hosting platform (deploy + ops + Faz 0-3)

---

## Durum Özeti

| Alan | Durum |
|------|-------|
| Deploy (Dokploy) | ✅ Canlı — kleacore.com |
| SSL | ✅ Let's Encrypt |
| Security audit | ✅ Tamamlandı |
| Faz 0 ödeme orchestrator | ✅ Kodda mevcut (Stripe checkout) |
| Faz 0 event dispatcher | ✅ Kodda mevcut |
| Production Stripe/SMTP | ❌ Env eksik |
| Cron jobs | ❌ Zamanlanmadı |
| 2FA | ❌ UI stub |
| CI/CD | ❌ Yok |

---

## Wave 1 — Stabilizasyon (Gün 1)

### Görev 1.1: Test & build doğrulama
- Tüm testleri geçir (plan-change.test.ts fix)
- `pnpm typecheck && pnpm build`

### Görev 1.2: Cron job kurulumu
- `scripts/setup-cron-jobs.mjs` — Dokploy veya harici scheduler
- 6 endpoint + CRON_SECRET auth

### Görev 1.3: CI/CD pipeline
- `.github/workflows/ci.yml` — PR'da test + build

### Görev 1.4: KVKK çerez banner
- `CookieConsent` component + localStorage

---

## Wave 2 — Production Config (Gün 2)

### Görev 2.1: Dokploy env güncelleme
- Stripe keys (kullanıcı sağlayacak)
- SMTP config
- SEED_ADMIN_PASSWORD kaldır

### Görev 2.2: Smoke test script
- `scripts/smoke-production.mjs` — canlı site kontrolü

### Görev 2.3: DB backup script
- `scripts/backup-postgres.sh` — Dokploy postgres dump

---

## Wave 3 — Faz 0 Tamamlama (Gün 3-5)

## PR Plan

### PR 1: Test fixes & Faz 0 verification

- **Description:** Fix failing plan-change tests. Verify payment orchestrator, fulfillment, renewal extend, auto-unsuspend paths have test coverage. Add integration tests for panel invoice + renewal Stripe redirect flow.
- **Files/components affected:** `src/lib/services/plan-change.test.ts`, `src/lib/payments/*.test.ts`, `src/lib/payments/fulfillment.ts`, `src/lib/payments/renewal-fulfillment.ts`
- **Dependencies:** None

### PR 2: 2FA TOTP implementation

- **Description:** Implement TOTP two-factor authentication for customer and admin accounts. QR code setup, backup codes, login challenge. Wire admin settings `two_factor` toggle.
- **Files/components affected:** `src/lib/auth/two-factor.ts`, `src/app/musteri/panel/ayarlar/content.tsx`, `src/app/musteri/giris/`, `prisma/schema.prisma`, migration
- **Dependencies:** None

### PR 3: Provisioning retry queue admin UI

- **Description:** Admin panel page for failed provisioning jobs. Retry button, error details, link to service. Enhance retry-provisioning cron.
- **Files/components affected:** `src/app/yonetim/provisioning/`, `src/lib/provisioning/retry-queue.ts`, `prisma/schema.prisma`
- **Dependencies:** PR 1

### PR 4: iyzico production hardening

- **Description:** Ensure iyzico callback, iframe sandbox, and admin gateway selector work end-to-end. Add iyzico webhook signature verification tests.
- **Files/components affected:** `src/lib/integrations/payment-gateways/`, `src/app/api/payments/iyzico/`, `src/app/odeme/iyzico/`
- **Dependencies:** PR 1

---

## Wave 4 — Entegrasyonlar (Hafta 2)

### Görev 4.1: Gri Registrar
- Admin entegrasyonlar → API test
- Domain kayıt sayfası canlı sorgu

### Görev 4.2: cPanel/WHM
- Provisioning provider config
- Test hosting siparişi

### Görev 4.3: SMS (Netgsm)
- Admin config + test SMS

---

## Wave 5 — Büyüme (Hafta 3-4)

### Görev 5.1: SEO
- Google Search Console sitemap submit
- Blog seed content (10 makale)

### Görev 5.2: Affiliate payout workflow
- Admin onay + ödeme akışı

### Görev 5.3: Staging ortamı
- `staging.kleacore.com` Dokploy app

### Görev 5.4: Monitoring
- UptimeRobot / Sentry entegrasyonu

---

## PR Plan (Wave 5)

### PR 5: Affiliate payout admin workflow

- **Description:** Complete affiliate payout request → admin approve → mark paid flow with email notification.
- **Files/components affected:** `src/lib/affiliate/payouts.ts`, `src/app/yonetim/affiliate-odemeleri/`, `src/app/musteri/panel/satis-ortakligi/`
- **Dependencies:** PR 1

### PR 6: Staging environment bootstrap

- **Description:** `scripts/dokploy-staging.mjs` — duplicate app config for staging with separate DB.
- **Files/components affected:** `scripts/dokploy-staging.mjs`, `docs/DEPLOY-CHECKLIST.md`
- **Dependencies:** None