# KLEACORE — Production Deploy Checklist

**Son güncelleme:** 17 Haziran 2026  
**Hedef:** Vercel + PostgreSQL (managed) veya Docker self-host

---

## 1. Ön Koşullar

- [ ] Node.js 20+ (Vercel otomatik)
- [ ] PostgreSQL 16+ erişilebilir
- [ ] Domain + SSL (Vercel veya reverse proxy)
- [ ] Stripe hesabı (canlı anahtarlar)
- [ ] SMTP veya transactional e-posta servisi

---

## 2. Ortam Değişkenleri (Zorunlu)

| Değişken | Açıklama |
|----------|----------|
| `DATABASE_URL` | PostgreSQL connection string (pooler önerilir) |
| `AUTH_SECRET` | `openssl rand -base64 32` |
| `NEXTAUTH_URL` | Canonical URL (`https://kleacore.com`) |
| `NEXT_PUBLIC_APP_URL` | Aynı public URL |
| `APP_URL` | Server-side URL |
| `STRIPE_SECRET_KEY` | `sk_live_...` |
| `STRIPE_WEBHOOK_SECRET` | Stripe Dashboard webhook signing secret |
| `CRON_SECRET` | Cron endpoint koruması (`openssl rand -hex 32`) |

### Önerilen (Opsiyonel)

| Değişken | Açıklama |
|----------|----------|
| `WEBHOOK_SIGNING_SECRET` | Outbound webhook HMAC |
| `SMTP_HOST`, `SMTP_USER`, `SMTP_PASSWORD` | E-posta |
| `REGISTRAR_*` | Gri domain API |
| `STRIPE_PUBLISHABLE_KEY` | İstemci tarafı (gerekirse) |

Admin panelden yapılandırılanlar (DB `settings`): iyzico, PayTR, cPanel, Virtualizor, SMS, e-fatura, SSL provider.

---

## 3. Veritabanı

```bash
pnpm install
pnpm prisma generate
pnpm db:migrate:deploy    # Production — asla migrate dev kullanmayın
# İlk kurulumda (isteğe bağlı):
pnpm prisma db seed
```

**Doğrulama:**
```bash
pnpm prisma migrate status   # "Database schema is up to date"
```

---

## 4. Build & Test (CI / Pre-deploy)

```bash
pnpm typecheck    # 0 hata
pnpm test         # Tüm testler geçmeli (122+)
pnpm build        # next build başarılı
```

**Not:** Client component'ler (`"use client"`) doğrudan `@/lib/db` veya server-only modülleri import etmemeli. Sabitler için `src/lib/affiliate/constants.ts`, fiyat hesabı için `src/lib/products/configurator-pricing.ts` kullanın.

---

## 5. Stripe Webhook

1. Stripe Dashboard → Webhooks → Add endpoint  
   URL: `https://<domain>/api/payments/stripe/webhook`
2. Events: `checkout.session.completed`
3. Signing secret → `STRIPE_WEBHOOK_SECRET`
4. Test: Stripe CLI `stripe listen --forward-to localhost:3000/api/payments/stripe/webhook`

### iyzico / PayTR (Türkiye)

- Callback URL'leri admin → Entegrasyonlar → Ödeme'den alın
- iyzico: `https://<domain>/api/payments/iyzico/callback`
- PayTR: `https://<domain>/api/payments/paytr/callback`

---

## 6. Vercel Cron Jobs

`vercel.json` tanımlı cron'lar (Pro plan gerekir):

| Endpoint | Schedule | Görev |
|----------|----------|-------|
| `/api/cron/daily-billing` | 02:00 | Yenileme faturaları |
| `/api/cron/overdue-invoices` | 05:00 | Gecikmiş faturalar |
| `/api/cron/suspend-services` | 06:00 | Askıya alma |
| `/api/cron/run-backups` | saatlik (:15) | Zamanlanmış yedek (VDS saat penceresi), süresi dolan fesih yedeklerinin silinmesi |
| `/api/cron/ssl-expiry` | 04:00 | SSL süre kontrolü |
| `/api/cron/retry-provisioning` | */15 dk | Provisioning retry |

**Auth:** Her istekte `Authorization: Bearer <CRON_SECRET>` veya `x-cron-secret: <CRON_SECRET>`

Manuel test:
```bash
curl -X POST https://<domain>/api/cron/daily-billing \
  -H "Authorization: Bearer $CRON_SECRET"
```

---

## 7. Entegrasyon Merkezi (Admin)

Sırayla yapılandırın:

1. **Registrar (Gri)** — domain kayıt/transfer
2. **cPanel/WHM** — hosting + e-posta + yedekleme
3. **VPS/VDS (Virtualizor)** — sunucu provisioning
4. **Ödeme** — Stripe / iyzico / PayTR seçimi
5. **SMTP** — bildirim e-postaları
6. **SMS** — Netgsm veya İleti Merkezi
7. **E-Fatura** — mock veya Paraşüt (taslak)
8. **SSL** — mock / Let's Encrypt / Sectigo
9. **Webhook** — outbound order/payment URL'leri

Her modülde **Bağlantıyı Test Et** kullanın.

---

## 8. Post-Deploy Smoke Test

### Public sayfalar (200 OK)
- `/` — Ana sayfa
- `/domain/kayit`, `/domain/transfer`, `/domain/whois`
- `/hosting/linux`, `/ssl/standart`
- `/api-docs`
- `/api/v1/openapi` — OpenAPI JSON

### Auth
- `/giris` — 308 redirect → `/musteri/giris`
- Admin: `/yonetim` (ADMIN rolü)
- Müşteri: `/musteri/panel`
- Hızlı doğrulama: `node scripts/smoke-auth.mjs` (seed kullanıcıları gerekir)

### API (API key gerekli)
```bash
curl -H "Authorization: Bearer kc_live_..." https://<domain>/api/v1/invoices
curl -H "Authorization: Bearer kc_live_..." https://<domain>/api/v1/services
```

### Ödeme akışı (staging)
1. Sepet → Kredi kartı → Stripe test kartı `4242...`
2. Webhook → fatura PAID → provisioning
3. Panel fatura ödeme → Stripe redirect
4. Bakiye yükleme → yalnızca Stripe (havale kapalı)

### Cron (staging)
```bash
# Her cron endpoint 200 + JSON body
curl -X POST .../api/cron/retry-provisioning -H "Authorization: Bearer $CRON_SECRET"
```

---

## 9. Güvenlik Kontrol Listesi

- [ ] `AUTH_SECRET` güçlü ve benzersiz
- [ ] `CRON_SECRET` production'da set
- [ ] `.env` git'e commit edilmemiş
- [ ] Admin şifreleri seed'den değiştirilmiş (seed kullanıldıysa)
- [ ] Stripe webhook signature doğrulaması aktif
- [ ] Rate limit API v1 endpoint'lerinde aktif
- [ ] `loadBalance()` kanıtsız yükleme devre dışı (yalnızca Stripe top-up)

---

## 10. Rollback Planı

1. Vercel → önceki deployment'a promote
2. DB rollback: Prisma migrate geri alma riskli — migration öncesi DB snapshot alın
3. Stripe webhook eski URL'de kalabilir (domain değişmezse sorun yok)

---

## 11. İzleme (Önerilen)

- Vercel Analytics / Logs
- Stripe Dashboard → Webhook delivery log
- PostgreSQL connection pool metrikleri
- Cron başarısızlıkları: Vercel Cron log veya harici uptime monitor

---

## Hızlı Komut Özeti

```bash
# Local → Production pipeline
pnpm install
pnpm db:migrate:deploy
pnpm typecheck && pnpm test && pnpm build

# Vercel
vercel --prod
# veya Git push → main branch auto-deploy
```