# KLEACORE — QA Smoke Raporu

**Tarih:** 17 Haziran 2026  
**Ortam:** Local dev (`http://localhost:3000`)  
**DB:** 15 migration uygulandı (`pnpm db:migrate:deploy`)

---

## CI Sonuçları

| Kontrol | Sonuç |
|---------|-------|
| `pnpm typecheck` | ✅ Geçti |
| `pnpm test` | ✅ 122/122 |
| `pnpm build` | ✅ Geçti (client/server import ayrımı düzeltildi) |

---

## HTTP Smoke Test

| Endpoint | Beklenen | Sonuç |
|----------|----------|-------|
| `GET /` | 200 | ✅ 200 |
| `GET /domain/kayit` | 200 | ✅ 200 |
| `GET /domain/transfer` | 200 | ✅ 200 |
| `GET /api-docs` | 200 | ✅ 200 |
| `GET /musteri/giris` | 200 | ✅ 200 |
| `GET /yonetim/entegrasyonlar` | 200/302 | ✅ 200 |
| `GET /api/v1/openapi` | 200 + OpenAPI 3.0 | ✅ 3.0.3, 9 path |
| `GET /api/v1/invoices` (key yok) | 401 | ✅ 401 |
| `POST /api/cron/daily-billing` (auth yok) | 401 | ✅ 401 |

---

## Genişletilmiş HTTP Smoke (2. tur)

| Endpoint | Sonuç |
|----------|-------|
| `GET /giris` | ✅ 308 → `/musteri/giris` |
| `GET /domain/whois` | ✅ 200 |
| `GET /hosting/linux` | ✅ 200 |
| `GET /ssl/standart` | ✅ 200 |
| `GET /sepet` | ✅ 200 |
| `GET /odeme/iyzico`, `/odeme/paytr` | ✅ 200 |
| `GET /odeme` (root) | ⚠️ 404 — callback sayfaları alt path'te |
| `GET /yonetim`, `/musteri/panel` (oturumsuz) | ✅ 307 → giriş |

### Cron (`CRON_SECRET` ile)

| Endpoint | Sonuç |
|----------|-------|
| `daily-billing` | ✅ 200 |
| `overdue-invoices` | ✅ 200 |
| `suspend-services` | ✅ 200 |
| `run-backups` | ✅ 200 |
| `ssl-expiry` | ✅ 200 |
| `retry-provisioning` | ✅ 200 |

---

## Auth Smoke (`node scripts/smoke-auth.mjs`)

Seed kullanıcıları ile NextAuth credentials akışı:

| Kullanıcı | Rol | Panel | Sonuç |
|-----------|-----|-------|-------|
| `ayse@demirholding.com` / `Demo123!` | CUSTOMER | `/musteri/panel` | ✅ 200 |
| `admin@kleacore.com` / `Admin123!` | ADMIN | `/yonetim` | ✅ 200 |

---

## Düzeltilen Build Blocker

**Sorun:** `satis-ortakligi/content.tsx` ve hosting wizard `configurator.ts` client bundle'a `pg`/Prisma çekiyordu.

**Çözüm:**
- `MIN_PAYOUT_AMOUNT` → `src/lib/affiliate/constants.ts`
- Configurator pricing → `configurator-pricing.ts` + `configurator-types.ts`

---

## Production Öncesi Manuel Test Listesi

Auth gerektiren akışlar staging'de test edilmeli:

- [ ] Sepet → Stripe test kartı → webhook → provisioning
- [ ] Panel fatura ödeme (Stripe redirect)
- [ ] Hizmet yenileme (KK + havale)
- [ ] Domain transfer (Gri aktifken)
- [ ] Affiliate ödeme talebi → admin onay
- [ ] Reseller checkout indirimi
- [ ] Cron endpoint'leri `CRON_SECRET` ile 200
- [ ] iyzico/PayTR callback (sandbox)

---

## Bilinen Notlar

- `/giris` kalıcı yönlendirme ile `/musteri/giris`'e bağlandı (`next.config.mjs`)
- Ödeme callback sayfaları: `/odeme/iyzico`, `/odeme/paytr` (root `/odeme` yok)
- Admin ve müşteri paneli auth middleware ile korunuyor (oturumsuz → giriş)
- Vercel Cron Pro plan gerektirir (`vercel.json` 6 job)
- Staging'de Stripe webhook + sepet E2E hâlâ manuel test listesinde