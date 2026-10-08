# KLEACORE UI Kit (public site)

Kit: `src/components/site/` (barrel: `@/components/site`). Prices: `src/lib/format/price.ts`.
Layout: `src/components/layout/{topbar,header,footer,user-menu,nav-data}.tsx`.
Reference implementation: `src/app/page.tsx` (homepage).

## Design rules

- **Monochrome.** Use the theme tokens: `foreground`, `background`, `muted`, `muted-foreground`, `border`. The only accent is **emerald, and only for status dots** (`StatusDot`/`StatusPill`). No blue/violet/amber gradients, no `text-primary` highlights.
- **Signature motifs:** dashed frame lines (`GridLineHorizontal/Vertical`, `DashedFrame`), the square background grid (`GridBackground`), beams on the hero rails (`Beams`), mono uppercase micro-labels (`Eyebrow`), and a dark featured card (`PlanCard featured`).
- **Type:** Geist Sans for text, Geist Mono (`font-mono text-[11px] uppercase tracking-[0.14em]`) for labels. Headings use `font-semibold tracking-tight`. Each page has **one `<h1>`** (in `PageHeader`/hero). Sections use `h2` (`SectionHeading`), and cards use `h3`.
- **Spacing:** wrap every block in `<Section>` (`py-16 md:py-24`; `spacing="sm" | "lg"`). Content width comes from `Container` (max-w-7xl, gutters 16/24/32px). Alternate `tone="muted"` and add `divider` between sections.
- **Buttons:** for links, use `<Link className={buttonClasses({ variant, size })}>`. Variants are `primary | outline | ghost | inverted`, and every size except `sm` is at least 44px tall. Inside forms, use `components/ui/button` or a `<button className={buttonClasses()}>`.
- **Always-dark areas:** add the `dark` class to the element (footer, topbar, featured card, `Section tone="contrast"`). This flips the tokens for that subtree.
- **Mobile:** no horizontal scroll at 390px. Tables must use `ComparisonTable`/`ServerPlanTable` (cards on phones). Touch targets ≥44px.
- **A11y:** every input has a `<label>` (an `sr-only` one is fine) or an `aria-label`. Icon-only buttons need `aria-label`. Decorative icons and SVGs get `aria-hidden`. Keep the focus-visible rings (`focus-visible:ring-2 ring-ring`).

## Content rules (mandatory)

- Copy must be **correct Turkish**. Plan names can stay as they are in the DB. Do not invent English labels such as "Dedicated Hardware" or "Popular".
- **Prices come from the DB only** (DAL `src/lib/dal/products.ts`, mappers `src/lib/products/map-product.ts`). Never hard-code amounts in copy, nav, badges or tables.
- Prices are **VAT-exclusive**. Render them with `<Price>` (it adds the "+KDV" note) or `formatTRY()`. When a page shows prices, mention once that "Fiyatlara KDV dahil değildir; %20 KDV ödeme adımında eklenir." (PlanGrid already does this).
- **No fake social proof or unverifiable claims:** no testimonials, customer counts, partner logos, "%30 indirim" banners, "10x hızlı", "%99.9 uptime garantisi", Tier III, "10+ Tbps", or locations we don't serve. Use only verifiable facts: NVMe SSD, LiteSpeed, cPanel, ücretsiz Let's Encrypt SSL, İstanbul lokasyon, 7/24 destek, haftalık/günlük yedek (per package), and the data in the product records.
- Compute savings with `yearlySavingsPercent` / `maxYearlySavings`. Never write "%20 indirim" by hand. For Turkish suffixes after numbers, use `dativeSuffix(n)` ("%20'ye", "%16'ya").
- Add social links only when real URLs exist. Company details live in the footer: KLEAWORK DIGITAL LLC, EIN 36-5157418, 30 N Gould St Ste R, Sheridan, WY 82801, USA, support@kleacore.com.

## Price helpers — `@/lib/format/price`

| fn | example |
|---|---|
| `formatTRY(n, {keepDecimals?, symbol?})` | `99.99 → "99,99 ₺"`, `49 → "49 ₺"`, `1299 → "1.299 ₺"` |
| `periodLabel("monthly"\|"yearly")` | `"ay"` / `"yıl"` |
| `yearlySavingsPercent(monthly, yearlyMonthly)` | `(49, 39) → 20` |
| `maxYearlySavings(plans)` | the highest saving across plans |
| `dativeSuffix(n)` | `20 → "ye"`, `16 → "ya"` |

**DB pricing semantics:** the `yearly` tier `price` is stored as the **monthly equivalent** of yearly billing. For example, Linux Starter is 49/ay monthly, and its yearly tier is 39, meaning 39/ay when paid yearly.

## Components

| Component | Kind | Props (main) |
|---|---|---|
| `Container` | server | `size?: "narrow"\|"default"\|"wide"` |
| `Section` | server | `tone?: "default"\|"muted"\|"contrast"`, `spacing?: "none"\|"sm"\|"default"\|"lg"`, `container?: size\|false`, `rails?`, `divider?`, plus any section attributes (`id`, `aria-labelledby`) |
| `SectionHeading` | server | `eyebrow?`, `title`, `description?`, `align?: "left"\|"center"`, `as?: "h1"\|"h2"\|"h3"`, `id?`, `actions?` |
| `Eyebrow` | server | `children`, `dot?` |
| `PageHeader` | server (+client Beams) | `title`, `description?`, `eyebrow?`, `breadcrumbs?: {label, href?}[]`, `actions?`, `children?`, `align?`, `beams?` — renders the `<h1>` and the BreadcrumbList JSON-LD |
| `Breadcrumbs` | server | `items` ("Ana Sayfa" is added automatically) |
| `GridLineHorizontal` / `GridLineVertical` | server | `className` (position it: `top-0`, `left-0`, `md:-inset-x-16`…), `fade?` |
| `DashedFrame`, `GridBackground`, `CornerTicks` | server | decorative helpers |
| `Beams` | **client** | `beams?`, `rails?` (respects reduced motion) |
| `Price` | server | `amount`, `period?: "ay"\|"yıl"\|"monthly"\|"yearly"`, `size?: "sm"\|"md"\|"lg"\|"xl"`, `vatNote?` (default true), `from?` |
| `StatusPill` / `StatusDot` | server | `tone?: "online"\|"neutral"`, `pulse?` |
| `TrustBar` | server | `items?: {icon?, label, description?}[]` (defaults to the factual hosting set; `backupTrustItem` is also exported) |
| `FeatureGrid` | server | `items: {icon?, title, description}[]`, `columns?: 2\|3\|4`, `variant?: "bordered"\|"inline"` |
| `CtaBand` | server | `eyebrow?`, `title`, `description?`, `primary: {label, href}`, `secondary?`, `aside?` |
| `FaqSection` / `FaqList` | **client** | `items?` or `groups?: {title, items}[]`, `eyebrow?`, `title?`, `description?`, `jsonLd?` (FAQPage, default true), plus Section props |
| `BillingSwitch` | **client** | `value: "monthly"\|"yearly"`, `onChange`, `savingsPercent?` |
| `PlanCard` | server-compatible | `plan: PlanCardData`, `billing?` |
| `PlanGrid` | **client** | `plans: PlanCardData[]`, `defaultBilling?` or controlled `billing` + `onBillingChange`, `showSwitch?`, `emptyMessage?` |
| `ServerPlanTable` | server-compatible | `plans: ServerPlanRow[]`, `billing?`, `columns?: {key,label}[]` (default cpu/ram/disk/traffic), `caption?` — a table on desktop and cards on phones |
| `ComparisonTable` | server-compatible | `columns: {key, label, highlight?, footer?}[]`, `rows: {label, icon?, values: Record<key, string\|boolean\|null>}[]`, `caption?`, `footerLabel?` |
| `InfraStack` | server | `layers?: {key,label,value}[]`, `title?`, `note?` (a schematic, not live data) |

**Icons in data** (`icon` fields): pass a lucide component, or a **string name** from `src/lib/utils/icon-map.ts` when the data crosses from a server page to a client component. Functions are not serialisable.

### Data adapters (`src/lib/products/map-product.ts`)

- `productToPlanCard(product, { href?, ctaLabel?, maxSpecs? }) → PlanCardData`. The default CTA is `/hosting/satin-al/{slug}`, and `featured` comes from `isPopular`.
- `productToServerRow(product, { href, ctaLabel? }) → ServerPlanRow`
- The legacy `mapProductToHostingPlan` / `mapProductToServerPlan` still exist. `ServerPlanView` now has `yearlyMonthly`, and `yearlyPrice` is the yearly total.

### Legacy wrappers (keep working, now built on the kit)

`sections/page-hero` (`PageHero` → `PageHeader`; `accent` and `badgeIcon` are ignored), `sections/trust-strip` (`TrustStrip`, `domainTrustItems`, `sslTrustItems`), `sections/cta` (`CTA`), `hosting/pricing-card` (`PricingCard`, `HostingPlan`, `hostingPlanToCard`), `hosting/billing-toggle` (`BillingToggle` with an optional new `savingsPercent`), `hosting/feature-comparison` (now requires `plans`; with no plans it renders nothing), `hosting/hosting-features`, `sunucu/server-features`, `sunucu/server-faq`, `ssl/ssl-features`, `ssl/ssl-faq`, `veri-merkezi/datacenter-features`. Prefer the kit directly in new code.

## Sayfa şablonu

```tsx
// src/app/hosting/linux/page.tsx  (server)
import type { Metadata } from "next";
import { getProductsBySubType } from "@/lib/dal/products";
import { productToPlanCard } from "@/lib/products/map-product";
import { Content } from "./content";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Linux Hosting",               // -> "Linux Hosting | KLEACORE" (root template)
  description: "cPanel ve LiteSpeed ile Linux hosting paketleri. Ücretsiz Let's Encrypt SSL…",
  alternates: { canonical: "/hosting/linux" },  // REQUIRED on every page
  openGraph: { title: "Linux Hosting | KLEACORE", url: "/hosting/linux" },
};

export default async function Page() {
  const products = await getProductsBySubType("hosting", "linux");
  return <Content plans={products.map((p) => productToPlanCard(p))} />;  // serialisable props only
}
```

```tsx
// content.tsx — "use client" only if it needs state; otherwise make it a server component
import { Topbar } from "@/components/layout/topbar";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { PageHeader, PlanGrid, Section, SectionHeading, FeatureGrid, FaqSection, CtaBand, TrustBar } from "@/components/site";

export function Content({ plans }: { plans: PlanCardData[] }) {
  return (
    <div className="flex min-h-screen flex-col">
      <Topbar />
      <Header />
      <main id="main" className="flex-1">
        <PageHeader
          eyebrow="NVMe SSD · LiteSpeed"
          title="Linux Hosting"
          description="…"
          breadcrumbs={[{ label: "Hosting", href: "/hosting/linux" }, { label: "Linux Hosting" }]}
        />
        <TrustBar />
        <Section><PlanGrid plans={plans} /></Section>
        <Section tone="muted" divider>
          <SectionHeading eyebrow="…" title="…" className="mb-12" />
          <FeatureGrid items={…} />
        </Section>
        <FaqSection items={…} divider />
        <CtaBand title="…" primary={{ label: "…", href: "…" }} />
      </main>
      <Footer />
    </div>
  );
}
```

SEO notes:
- The root layout (`src/app/layout.tsx`) sets `title.template = "%s | KLEACORE"`, a Turkish default description, OG locale `tr_TR` and `metadataBase`. It deliberately sets **no canonical**: each page sets its own `alternates.canonical`.
- For `[slug]` routes, use `generateMetadata`. Use `title: { absolute: "…" }` to skip the template.
- `next.config.mjs` 301s: `/hosting`→`/hosting/linux`, `/sunucu`→`/sunucu/vds`, `/ssl`→`/ssl/standart`, `/domain`→`/domain/kayit`, `/veri-merkezi`→`/veri-merkezi/barindirma`, `www.kleacore.com`→`kleacore.com`. Don't recreate those index routes.

## Do / Don't

- **Do:** use `Section` + `SectionHeading` for every block, `Price` for every amount, and `PlanGrid`/`ServerPlanTable`/`ComparisonTable` for pricing. Test at 390px and 1440px in both themes.
- **Don't:** add carousels or auto-rotating heroes, use colourful gradients, `BorderBeam`, particles, `text-primary` accents, invented badges ("Yeni", "Premium"), strike-through "old" prices derived from renewal prices, or `overflow-x-auto` tables on mobile without a card fallback.
