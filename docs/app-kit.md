# KLEACORE App Kit (customer + admin panels)

Kit: `src/components/app/` (barrel: `@/components/app`). Dates: `src/lib/format/date.ts`. Money: `formatTRY` from `src/lib/format/price.ts`.
Reference implementation: the customer panel (`src/app/musteri/panel/layout.tsx`, `src/components/panel/customer-shell.tsx`, `src/app/musteri/panel/{page,faturalar,hizmetlerim,domainler,destek}`).

It shares the public kit's visual language (`docs/ui-kit.md`): monochrome tokens, Geist Sans + Geist Mono micro-labels, dashed details. It is **denser**: 14px body, 36px controls on desktop, cards instead of sections.

## Rules

- **Monochrome.** Text, borders and fills use `foreground / background / muted / muted-foreground / border / card`. **Colour lives only in status dots** (`StatusBadge`, `ToneDot`, `StatCard tone`) and meter fills over 70% / 90% (`UsageMeter`). No `text-primary`, no blue/green/orange cards, no gradients.
- **One `<h1>` per page**, rendered by `PageHeader`. Cards use `h2` (`SectionCard` default) or `h3` (`headingLevel={3}`) when nested.
- **Buttons:** `appButton({ variant, size })` for both `<Link>` and `<button>`. Variants: `primary | outline | secondary | ghost | destructive`. Sizes: `md | sm | icon | icon-sm`. Every size is ≥44px on phones and shrinks on `md+`. `components/ui/button` still works inside forms and dialogs, but prefer `appButton` for new code.
- **Statuses:** never write status labels or colours by hand. Use `<StatusBadge kind="invoice" status={x.status} />`. The labels and tones live in `status-map.ts`, which covers every Prisma status enum.
- **Unfinished features:** don't build buttons that pretend to work. Use `<UnavailableAction label="cPanel" reason="Yakında" />`, which renders a disabled control with a tooltip. In row menus, pass `{ label, disabledReason: "Yakında" }`.
- **Money:** use `formatTRY(n, { keepDecimals: true })` in the panels, where invoice amounts always show kuruş. **Dates:** use `formatDate`, `formatDateTime` and `formatDateLong`. They are tr-TR and pinned to Europe/Istanbul, so server and client render the same output. Billing periods: `billingPeriodLabel("yearly")` returns "Yıllık", and `billingPeriodUnit` returns "yıl".
- **Mobile:** no page-level horizontal scroll at 390px. `DataTable` needs a `mobileCard` (use `ListRow`) for any table with more than 3 columns. Toolbars stack, and filter tabs scroll inside their own row.
- **A11y:** icon-only buttons need `aria-label`, and decorative icons get `aria-hidden`. Inputs use `FormField` (label + control) or `aria-label`. Keep focus rings. `AppShell` adds the "İçeriğe geç" skip link and `<main id="main">`.
- **Private pages:** the panel layout sets `robots: { index: false }` and the title template. Pages only export `metadata = { title: "Faturalarım" }`.
- **Icons across the server/client boundary:** nav configs contain lucide components, which can't be serialised. Build the nav **inside a client component** (see `CustomerShell`) and pass only plain data (user, counts, flags) from the server layout.

## Layout (shell)

```tsx
// src/app/<area>/layout.tsx  (server)
export const metadata: Metadata = {
  title: { default: "Yönetim | KLEACORE", template: "%s · Yönetim | KLEACORE" },
  robots: { index: false, follow: false },
};
export default async function Layout({ children }) {
  const session = await requireAdmin();
  const counts = await …;                      // plain numbers only
  return <AdminShell user={{ name, email }} counts={counts}>{children}</AdminShell>;
}
```

```tsx
// src/components/admin/admin-shell.tsx  ("use client")
const nav: AppNavGroup[] = [
  { items: [{ title: "Genel bakış", href: "/yonetim", icon: LayoutDashboard, exact: true }] },
  { label: "Satış", items: [{ title: "Siparişler", href: "/yonetim/siparisler", icon: ShoppingCart, badge: counts.pendingOrders }] },
];
<AppShell
  nav={nav}
  brand={{ href: "/yonetim", label: "Yönetim" }}
  breadcrumbRoot={{ label: "Yönetim", href: "/yonetim" }}
  segmentLabels={{ yeni: "Yeni", duzenle: "Düzenle" }}
  search={<AppCommandSearch nav={nav} />}
  notifications={<AppNotifications items={…} />}
  themeToggle={<AppThemeToggle />}
  userMenu={<AppUserMenu name={user.name} email={user.email} links={[…]} />}
  sidebarFooter={…optional…}
>
  {children}
</AppShell>
```

The shell has these parts:
- **Desktop sidebar:** grouped nav with a mono group label, an active item marked by `bg-muted` plus a 2px rail, and badges for counts (hidden at 0). The bottom button collapses it to a 64px icon rail with tooltips, and the state persists in `localStorage` (`kc-app-sidebar-collapsed`).
- **Mobile drawer:** a left Radix dialog that closes on navigation.
- **Top bar:** the breadcrumb is derived from the path under `breadcrumbRoot`. A crumb uses the nav title when the href matches a nav item, then `segmentLabels`, then "Detay" for id-like segments, and finally the humanised segment. On phones only the last crumb shows. Override a crumb from a page with `<AppBreadcrumbLabel segment={invoice.id} label={invoice.invoiceNumber} />`.
- **Slots:** `search`, `notifications`, `themeToggle`, `userMenu` and `sidebarFooter`. All are optional.
- **Content:** `<main id="main">` is centred, max 1320px, `px-4 md:px-6 lg:px-8`, with `space-y-6` between direct children. Don't add another container in pages.
- **Tooltips:** the shell provides `TooltipProvider`.

Top bar items (`topbar-items.tsx`, client):

| Component | Props |
|---|---|
| `AppThemeToggle` | – |
| `AppUserMenu` | `name`, `email?`, `links?: {label, href, icon?}[]`. Logout (`LogoutButton`) is always last. |
| `AppNotifications` | `items: {id,title,message,createdAt(ISO),isRead,link?,type?}[]`, `emptyText?`. Read-only list; no "mark all read" because no action exists. |
| `AppCommandSearch` | `nav`, `extra?: {title,href,group?,icon?,keywords?}[]`, `placeholder?`. ⌘K / Ctrl+K. **Searches pages only**, not data. |

## Components

| Component | Kind | Props (main) |
|---|---|---|
| `PageHeader` | server | `title`, `description?`, `eyebrow?` (mono micro-label), `back?: {href,label}`, `meta?` (row under the description: badges, dates), `actions?` |
| `SectionCard` | server | `title?`, `description?`, `actions?`, `footer?`, `flush?` (no body padding, for tables and lists), `headingLevel?: 2\|3`, `as?`, `id?`, `bodyClassName?` |
| `StatCard` | server | `label`, `value`, `hint?`, `icon?`, `href?` (whole card becomes a link with ↗), `tone?` (dot before the hint) |
| `StatGrid` | server | `columns?: 2\|3\|4\|5`. 2 columns on phones. |
| `StatusBadge` | server | `kind` + `status` (+ `audience?: "customer"\|"admin"`, which changes ticket labels), **or** a free `tone` + `label`. `size?: "sm"\|"md"` |
| `ToneDot` | server | `tone` |
| `EmptyState` | server | `icon?`, `title`, `description?`, `action?`, `compact?`. Dashed frame. |
| `DetailList` | server | `items: {label, value, mono?, copy?, hideEmpty?}[]`, `layout?: "rows"\|"grid"`, `columns?: 2\|3`. Empty values are hidden by default. |
| `FormSection` | server | `title`, `description?`, `children`, `footer?`. Title is on the left from `lg`, with the fields in a card. |
| `FormField` | server | `label`, `htmlFor`, `hint?`, `error?`, `required?`, `children` |
| `UsageMeter` | server | `label`, `used?`, `limit?`, `unit?`, or `percent?`; `warnAt?` (70), `dangerAt?` (90) |
| `ChartCard` | server | `title`, `description?`, `actions?`, `data: {label,value}[]`, `formatValue?`, `height?`, `emptyText?`. Dependency-free CSS bars plus an sr-only table. If you need lines or areas, add recharts and keep it inside a `SectionCard`. |
| `ListRow` | server | `title`, `subtitle?`, `trailing?`, `meta?`, `leading?`. The standard `mobileCard` body. |
| `IconTile` | server | `size?: "sm"\|"md"\|"lg"`. A bordered square for an icon. |
| `PageSkeleton` | server | `variant?: "list"\|"detail"\|"dashboard"\|"form"`. Use it in `loading.tsx`. |
| `DataTable` | **client** | see below |
| `RowActionsMenu` | **client** | `actions: RowAction[]`, `label?` |
| `UnavailableAction` | **client** | `label`, `icon?`, `reason?` ("Yakında"), `variant?`, `size?`, `layout?: "button"\|"tile"`, `description?` (tile) |
| `CopyButton` | **client** | `value`, `label?` |
| `appButton()` | fn | `{ variant?, size?, className? }` |
| `getStatusMeta(kind, status, audience?)` | fn | `→ { label, tone }` |
| `getStatusOptions(kind, audience?)` | fn | `→ {value,label}[]`, for filters and selects |
| `enumLabel(kind, value)` / `ENUM_LABELS` | fn | Non-status enums: `ticketDepartment`, `paymentMethod`, `backupType`, `sslType`, `customerType`, `userRole`, `transactionType`, `discountType`, `planChangeType`, `incidentSeverity`, `productCategory`, `dnsRecordType` |

`StatusKind` values: `service`, `invoice`, `order`, `ticket`, `ticketPriority`, `domain`, `ssl`, `payment`, `backup`, `provisioning`, `cancellation`, `planChange`, `eInvoice`, `user`, `product`, `emailAccount`, `systemStatus`, `incident`, `affiliatePayment`, `content` (blog/KB), `promo`.
Tones are `success` (emerald), `warning` (amber), `danger` (red), `info` (sky), `neutral` (foreground) and `muted` (hollow).

### DataTable

TanStack Table v8 (`@tanstack/react-table`). Search and filters run on the client over `data`; sorting and pagination are TanStack's.

```tsx
"use client";
import { DataTable, ListRow, StatusBadge, getStatusOptions, type ColumnDef } from "@/components/app";

const columns: ColumnDef<Row>[] = [
  { accessorKey: "invoiceNumber", header: "Fatura no", cell: ({ row }) => <span className="font-mono">{row.original.invoiceNumber}</span> },
  { id: "due", accessorFn: (r) => r.dueDate, header: "Son ödeme", cell: ({ row }) => formatDate(row.original.dueDate) },
  { accessorKey: "totalAmount", header: "Tutar", meta: { align: "right" }, cell: ({ row }) => formatTRY(row.original.totalAmount, { keepDecimals: true }) },
  { accessorKey: "status", header: "Durum", enableSorting: false, cell: ({ row }) => <StatusBadge kind="invoice" status={row.original.status} /> },
];

<DataTable
  columns={columns}
  data={rows}
  searchFn={(r, q) => r.invoiceNumber.toLocaleLowerCase("tr-TR").includes(q)}   // q is already lower-cased
  searchPlaceholder="Fatura no ara…"
  filters={[{ id: "status", label: "Durum", options: getStatusOptions("invoice"), getValue: (r) => r.status }]}
  initialSort={[{ id: "due", desc: true }]}
  rowHref={(r) => `/musteri/panel/faturalar/${r.id}`}
  rowActions={(r) => [
    { label: "Görüntüle", href: `/musteri/panel/faturalar/${r.id}`, icon: <Eye /> },
    { label: "PDF indir", disabledReason: "Yakında", icon: <Download /> },
  ]}
  mobileCard={(r) => <ListRow title={r.invoiceNumber} trailing={formatTRY(r.totalAmount)} meta={<StatusBadge kind="invoice" status={r.status} />} />}
  emptyState={<EmptyState icon={FileText} title="Henüz faturanız yok" />}
  toolbar={<button className={appButton({ variant: "outline", size: "sm" })}>Dışa aktar</button>}
/>
```

- Columns with an accessor are sortable. Set `enableSorting: false` to turn that off. `meta: { align, className, headerClassName, cellClassName }`.
- Filters default to `variant: "tabs"`, segmented buttons with counts. Use `variant: "select"` for long option lists. `allLabel` defaults to "Tümü", and `defaultValue` defaults to `"all"`.
- `pageSize` defaults to 10; set it to 0 for no pagination (dashboard previews). The pager is hidden when everything fits on one page.
- `rowHref` makes a row clickable (⌘/Ctrl-click opens a new tab). Clicks on links, buttons and menus inside the row are ignored.
- `framed={false}` drops the outer card. Use it inside `<SectionCard flush>`.
- `emptyState` replaces everything (toolbar included) when `data` is empty. The "no results" text covers filtered-empty.
- Without `mobileCard`, the table scrolls horizontally **inside its frame** on phones. Only accept that for tables with 3 or fewer columns.

## Page template

```tsx
// page.tsx (server): auth + DAL + serialise; no JSX logic
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Faturalarım" };
export default async function Page() {
  const session = await auth();
  const rows = (await getInvoicesByCustomer(session!.user.id)).map(serialise); // Dates → ISO strings, Decimal → number
  return <Content rows={rows} />;
}

// content.tsx ("use client" only when it needs state / DataTable / actions)
export function Content({ rows }) {
  return (
    <>
      <PageHeader title="Faturalarım" description="…" actions={…} />
      <StatGrid>…</StatGrid>
      <DataTable … />
    </>
  );
}

// loading.tsx
export default function Loading() { return <PageSkeleton variant="list" />; }
```

Detail page: `PageHeader back={{ href, label }} eyebrow="Fatura" meta={<StatusBadge …/>}`, then `grid items-start gap-6 lg:grid-cols-3` with main content in `lg:col-span-2` (SectionCards) and a sidebar column (summary `DetailList`, actions). Put a page's primary action in `PageHeader.actions` and repeat it in the sidebar only when the page is long.

Forms (settings): `<form>` → stacked `FormSection`s separated by `space-y-8`, each with its own submit in `footer` if they save independently.

## Do / Don't

- **Do:** use `StatusBadge` for every status, `formatTRY`/`formatDate*` for every amount/date, `EmptyState` for every empty list, `UnavailableAction` for every not-yet-wired action, and keep each server action / form field name / query param unchanged when restyling.
- **Don't:** use `BlurFade`/entrance animations on app pages (they delay data), coloured stat cards, invented numbers (e.g. hard-coded "0 domain"), English labels ("Dashboard", "Close"), or page-level `overflow-x-auto` tables without a card fallback.
