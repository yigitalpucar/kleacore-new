# KLEACORE

KLEACORE is a Turkish hosting and infrastructure billing platform built with **Next.js 16**, **Prisma**, **PostgreSQL**, and **NextAuth v5**. It includes a public storefront, customer panel, admin panel, Stripe payments, scheduled billing jobs, and a customer REST API.

## Tech stack

- **Framework:** Next.js 16 (App Router)
- **Database:** PostgreSQL 16 + Prisma
- **Auth:** NextAuth v5
- **Payments:** Stripe Checkout
- **Package manager:** pnpm

## Prerequisites

- Node.js 20+
- pnpm (`corepack enable`)
- Docker (for local PostgreSQL)

## Quick start

### 1. Install dependencies

```bash
pnpm install
```

### 2. Environment variables

Copy the example file and fill in required values:

```bash
cp .env.example .env
```

See [Environment variables](#environment-variables) below.

### 3. Start PostgreSQL

```bash
docker compose up -d postgres
```

Optional: run the app container as well:

```bash
docker compose --profile app up
```

### 4. Run migrations

```bash
pnpm prisma migrate dev
```

For production / CI deploys:

```bash
pnpm db:migrate:deploy
```

### 5. Seed the database

```bash
pnpm prisma db seed
```

### 6. Start the dev server

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

## Environment variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `AUTH_SECRET` | Yes | NextAuth session/JWT secret (`openssl rand -base64 32`) |
| `NEXTAUTH_URL` | Yes | Canonical app URL for auth callbacks |
| `NEXT_PUBLIC_APP_URL` | Yes | Public URL (Stripe redirects, sitemap) |
| `APP_URL` | Yes | Server-side base URL |
| `STRIPE_SECRET_KEY` | For card payments | Stripe secret key |
| `STRIPE_WEBHOOK_SECRET` | For webhooks | Stripe webhook signing secret |
| `CRON_SECRET` | For cron routes | Shared secret for `/api/cron/*` |
| `REGISTRAR_*` | Optional | Domain registrar integration |
| `PROVISIONING_*` | Optional | Service provisioning integration |
| `SMTP_*` / `EMAIL_*` | Optional | Outbound email |

Full reference: `.env.example`

## Cron jobs

Scheduled jobs live under `/api/cron/*` and require authentication:

```http
Authorization: Bearer <CRON_SECRET>
```

or:

```http
x-cron-secret: <CRON_SECRET>
```

| Endpoint | Schedule (Vercel) | Description |
|----------|-------------------|-------------|
| `GET /api/cron/daily-billing` | `0 2 * * *` (02:00 UTC daily) | Generate renewal invoices |
| `GET /api/cron/overdue-invoices` | `0 5 * * *` (05:00 UTC daily) | Mark overdue invoices |
| `GET /api/cron/suspend-services` | `0 6 * * *` (06:00 UTC daily) | Suspend services with overdue invoices |

`vercel.json` configures these schedules for Vercel Cron. Locally, trigger manually:

```bash
curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/daily-billing
curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/overdue-invoices
curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/suspend-services
```

## Customer REST API v1

Base path: `/api/v1`

Authentication via API key (create keys in **Müşteri Panel → Ayarlar**):

```http
Authorization: Bearer kc_live_...
```

or:

```http
x-api-key: kc_live_...
```

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/v1/invoices` | List customer invoices |
| `GET` | `/api/v1/invoices/{id}` | Invoice detail |
| `GET` | `/api/v1/tickets` | List support tickets |
| `POST` | `/api/v1/tickets` | Create support ticket |

Interactive docs: [/api-docs](/api-docs)

Example:

```bash
curl -H "Authorization: Bearer kc_live_YOUR_KEY" \
  "http://localhost:3000/api/v1/invoices?page=1&perPage=10"
```

## Development commands

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start Next.js dev server |
| `pnpm build` | Generate Prisma client and build for production |
| `pnpm start` | Start production server |
| `pnpm lint` | Run ESLint |
| `pnpm typecheck` | Run TypeScript check |
| `pnpm prisma migrate dev` | Create/apply migrations (dev) |
| `pnpm db:migrate:deploy` | Apply migrations (production) |
| `pnpm prisma db seed` | Seed database |
| `pnpm prisma studio` | Open Prisma Studio |

## Project structure

```
src/
  app/              # Next.js App Router pages & API routes
  lib/
    actions/        # Server actions
    dal/            # Data access layer
    cron/           # Scheduled job logic
    api/v1/         # REST API helpers
prisma/
  schema.prisma     # Database schema
  seed.ts           # Seed script
```

## Stripe webhooks (local)

Forward Stripe events to the local webhook endpoint:

```bash
stripe listen --forward-to localhost:3000/api/payments/stripe/webhook
```

Set `STRIPE_WEBHOOK_SECRET` from the CLI output.

## License

Private — KLEACORE internal use.