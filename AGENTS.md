# AGENTS.md — kleacore-new-source (KLEACORE)

## Proje Nedir?
KLEACORE: Türkçe hosting/altyapı satış ve faturalama platformu (WHMCS/WISECP alternatifi).
Public vitrin + müşteri paneli (`/musteri`) + admin paneli (`/yonetim`) + Stripe ödeme + cron faturalama + müşteri REST API (`/api/v1`).

## Stack
- Next.js 16 (App Router) + React 19 + TypeScript
- PostgreSQL 16 + Prisma 7 (`prisma/schema.prisma`)
- NextAuth v5 (beta) + 2FA (otpauth) + bcryptjs
- Stripe (ayrıca iyzico/PayTR env-flag'li), nodemailer, zod, zustand, Radix UI + shadcn tarzı bileşenler
- Paket yöneticisi: **pnpm** (npm kullanma!), Node 22
- Test: vitest

## Komutlar
```bash
pnpm dev                  # dev server (localhost:3000)
pnpm build                # prisma generate && next build
pnpm lint / pnpm typecheck / pnpm test
pnpm prisma migrate dev   # dev migration
pnpm db:migrate:deploy    # production migration
pnpm prisma db seed       # seed
docker compose up -d postgres   # lokal DB
# Ops (production/staging):
pnpm ops:smoke / ops:smoke:staging / ops:smoke:local
pnpm ops:cron:setup / ops:cron:health / ops:configure
```

## Klasör Haritası
```
src/app/          # Sayfalar: hosting, domain, ssl, sunucu, musteri, yonetim, odeme, sepet, api...
src/lib/
  actions/        # Server actions
  dal/            # Data access layer (DB erişimi buradan)
  cron/           # Zamanlanmış iş mantığı
  api/v1/         # REST API helper'ları
prisma/           # schema.prisma, migrations, seed.ts
scripts/          # smoke testler, dokploy deploy/staging, cron setup, pg backup
docs/             # DEPLOY-CHECKLIST, MASTER-EXECUTION-PLAN, QA-SMOKE-REPORT
static-export/    # eski statik site kopyası (dokunma)
```

## Env Değişkenleri (sadece isimler — değerleri ASLA kopyalama)
DATABASE_URL, AUTH_SECRET, NEXTAUTH_SECRET, ENCRYPTION_KEY, SEED_ADMIN_PASSWORD,
NEXTAUTH_URL, NEXT_PUBLIC_APP_URL, APP_URL,
STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,
IYZICO_*, PAYTR_*, CRON_SECRET, CRON_JOB_ORG_API_KEY, CRON_TIMEZONE, WEBHOOK_SIGNING_SECRET,
REGISTRAR_*, PROVISIONING_*, SMTP_*, EMAIL_FROM, EMAIL_NOTIFICATIONS,
DOKPLOY_URL, DOKPLOY_API_KEY, NODE_ENV, PORT
Tam referans: `.env.example`

## Konvansiyonlar & Tuzaklar
- Commit'ler İngilizce conventional commits (`feat:`, `fix:`, `chore:`).
- Auth config'de `trustHost` gerekli (localhost redirect bug'ı yaşandı) — kaldırma.
- Login/logout sonrası session sync için **full page reload** kullanılıyor; client-side redirect'e çevirme.
- Ops scriptleri varsayılan olarak **production URL**'e vurur (lokal .env'e değil) — dikkatli çalıştır.
- Seed build pipeline'ından bilinçli olarak çıkarıldı; build'e geri ekleme.
- Cron endpoint'leri `/api/cron/*` — `Authorization: Bearer <CRON_SECRET>` ister.
- Müşteri API anahtarları `kc_live_...` formatında; docs: `/api-docs`.
- Prisma 7 + Node 22 için Dockerfile özel ayarlandı; Dockerfile'ı değiştirirken build'i doğrula.

## Deploy
- **Dokploy** hedefi (scripts/dokploy-deploy.mjs, dokploy-staging.mjs, setup-dokploy-schedules.mjs).
- Staging: staging.kleacore.com, production: kleacore.com.
- Deploy öncesi `docs/DEPLOY-CHECKLIST.md`'ye bak; sonrası `pnpm ops:smoke`.
