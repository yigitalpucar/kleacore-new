"use client";

import Link from "next/link";
import {
  Ban,
  CheckCircle,
  Eye,
  FilePlus,
  FileText,
  Globe,
  Headphones,
  Mail,
  Package,
  PackagePlus,
  ShoppingCart,
  Wallet,
  XCircle,
} from "lucide-react";
import {
  AppBreadcrumbLabel,
  DataTable,
  DetailList,
  EmptyState,
  ListRow,
  PageHeader,
  SectionCard,
  StatCard,
  StatGrid,
  StatusBadge,
  appButton,
  enumLabel,
  type ColumnDef,
} from "@/components/app";
import { billingPeriodLabel, formatDate, formatDateTime } from "@/lib/format/date";
import { formatTRY } from "@/lib/format/price";
import { useCustomerActions } from "../use-customer-actions";
import { EditCustomerDialog } from "./edit-customer-dialog";

type ServiceRow = {
  id: string;
  productName: string;
  label: string | null;
  domain: string | null;
  status: string;
  billingPeriod: string;
  amount: number;
  nextDueDate: string | null;
  expiresAt: string | null;
};
type OrderRow = {
  id: string;
  orderNumber: string;
  productName: string;
  domain: string | null;
  status: string;
  totalAmount: number;
  createdAt: string;
};
type InvoiceRow = {
  id: string;
  invoiceNumber: string;
  status: string;
  totalAmount: number;
  dueDate: string;
  createdAt: string;
};
type TicketRow = {
  id: string;
  ticketNumber: string;
  subject: string;
  status: string;
  priority: string;
  createdAt: string;
};
type TransactionRow = {
  id: string;
  type: string;
  amount: number;
  balanceAfter: number;
  description: string;
  createdAt: string;
};

export type CustomerDetail = {
  id: string;
  email: string;
  name: string;
  surname: string;
  phone: string | null;
  status: string;
  customerType: string | null;
  companyName: string | null;
  taxNumber: string | null;
  taxOffice: string | null;
  address: string | null;
  city: string | null;
  country: string | null;
  balance: number;
  isReseller: boolean;
  twoFactorEnabled: boolean;
  emailVerifiedAt: string | null;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
  services: ServiceRow[];
  orders: OrderRow[];
  invoices: InvoiceRow[];
  tickets: TicketRow[];
  transactions: TransactionRow[];
  domains: { id: string; name: string; status: string; expiresAt: string }[];
  sslCount: number;
};

const money = (n: number) => formatTRY(n, { keepDecimals: true });

/* ---------------------------------------------------------------- columns */

const serviceColumns: ColumnDef<ServiceRow>[] = [
  {
    id: "name",
    accessorFn: (s) => s.productName,
    header: "Hizmet",
    cell: ({ row }) => (
      <div className="min-w-0 max-w-[240px]">
        <Link href={`/yonetim/hizmetler/${row.original.id}`} className="font-medium hover:underline">
          {row.original.productName}
        </Link>
        <p className="truncate text-xs text-muted-foreground">{row.original.domain || row.original.label || "—"}</p>
      </div>
    ),
  },
  {
    id: "amount",
    accessorFn: (s) => s.amount,
    header: "Tutar",
    meta: { align: "right" },
    cell: ({ row }) => (
      <span className="whitespace-nowrap tabular-nums">
        {money(row.original.amount)}
        <span className="block text-xs text-muted-foreground">{billingPeriodLabel(row.original.billingPeriod)}</span>
      </span>
    ),
  },
  {
    id: "due",
    accessorFn: (s) => s.nextDueDate ?? s.expiresAt ?? "",
    header: "Yenileme",
    cell: ({ row }) => (
      <span className="tabular-nums text-muted-foreground">{formatDate(row.original.nextDueDate ?? row.original.expiresAt)}</span>
    ),
  },
  {
    accessorKey: "status",
    header: "Durum",
    enableSorting: false,
    cell: ({ row }) => <StatusBadge kind="service" status={row.original.status} />,
  },
];

const invoiceColumns: ColumnDef<InvoiceRow>[] = [
  {
    accessorKey: "invoiceNumber",
    header: "Fatura",
    cell: ({ row }) => (
      <Link href={`/yonetim/faturalar/${row.original.id}`} className="font-mono text-[13px] font-medium hover:underline">
        {row.original.invoiceNumber}
      </Link>
    ),
  },
  {
    id: "createdAt",
    accessorFn: (i) => i.createdAt,
    header: "Tarih",
    cell: ({ row }) => <span className="tabular-nums text-muted-foreground">{formatDate(row.original.createdAt)}</span>,
  },
  {
    id: "dueDate",
    accessorFn: (i) => i.dueDate,
    header: "Son ödeme",
    cell: ({ row }) => <span className="tabular-nums">{formatDate(row.original.dueDate)}</span>,
  },
  {
    accessorKey: "totalAmount",
    header: "Tutar",
    meta: { align: "right" },
    cell: ({ row }) => <span className="whitespace-nowrap font-medium tabular-nums">{money(row.original.totalAmount)}</span>,
  },
  {
    accessorKey: "status",
    header: "Durum",
    enableSorting: false,
    cell: ({ row }) => <StatusBadge kind="invoice" status={row.original.status} />,
  },
];

const orderColumns: ColumnDef<OrderRow>[] = [
  {
    accessorKey: "orderNumber",
    header: "Sipariş",
    cell: ({ row }) => (
      <div className="min-w-0 max-w-[240px]">
        <Link href={`/yonetim/siparisler/${row.original.id}`} className="font-mono text-[13px] font-medium hover:underline">
          {row.original.orderNumber}
        </Link>
        <p className="truncate text-xs text-muted-foreground">
          {row.original.productName}
          {row.original.domain ? ` · ${row.original.domain}` : ""}
        </p>
      </div>
    ),
  },
  {
    id: "createdAt",
    accessorFn: (o) => o.createdAt,
    header: "Tarih",
    cell: ({ row }) => <span className="tabular-nums text-muted-foreground">{formatDate(row.original.createdAt)}</span>,
  },
  {
    accessorKey: "totalAmount",
    header: "Tutar",
    meta: { align: "right" },
    cell: ({ row }) => <span className="whitespace-nowrap font-medium tabular-nums">{money(row.original.totalAmount)}</span>,
  },
  {
    accessorKey: "status",
    header: "Durum",
    enableSorting: false,
    cell: ({ row }) => <StatusBadge kind="order" status={row.original.status} />,
  },
];

const ticketColumns: ColumnDef<TicketRow>[] = [
  {
    accessorKey: "subject",
    header: "Talep",
    cell: ({ row }) => (
      <div className="min-w-0 max-w-[280px]">
        <Link href={`/yonetim/destek/${row.original.id}`} className="font-medium hover:underline">
          {row.original.subject}
        </Link>
        <p className="font-mono text-xs text-muted-foreground">{row.original.ticketNumber}</p>
      </div>
    ),
  },
  {
    accessorKey: "priority",
    header: "Öncelik",
    enableSorting: false,
    cell: ({ row }) => <StatusBadge kind="ticketPriority" status={row.original.priority} />,
  },
  {
    id: "createdAt",
    accessorFn: (t) => t.createdAt,
    header: "Açılış",
    cell: ({ row }) => <span className="tabular-nums text-muted-foreground">{formatDate(row.original.createdAt)}</span>,
  },
  {
    accessorKey: "status",
    header: "Durum",
    enableSorting: false,
    cell: ({ row }) => <StatusBadge kind="ticket" audience="admin" status={row.original.status} />,
  },
];

const transactionColumns: ColumnDef<TransactionRow>[] = [
  {
    id: "description",
    accessorFn: (t) => t.description,
    header: "Açıklama",
    cell: ({ row }) => (
      <div className="min-w-0 max-w-[300px]">
        <p className="truncate">{row.original.description || enumLabel("transactionType", row.original.type)}</p>
        <p className="text-xs text-muted-foreground">{enumLabel("transactionType", row.original.type)}</p>
      </div>
    ),
  },
  {
    id: "createdAt",
    accessorFn: (t) => t.createdAt,
    header: "Tarih",
    cell: ({ row }) => <span className="tabular-nums text-muted-foreground">{formatDateTime(row.original.createdAt)}</span>,
  },
  {
    accessorKey: "amount",
    header: "Tutar",
    meta: { align: "right" },
    cell: ({ row }) => <span className="whitespace-nowrap font-medium tabular-nums">{money(row.original.amount)}</span>,
  },
  {
    accessorKey: "balanceAfter",
    header: "Sonraki bakiye",
    meta: { align: "right" },
    cell: ({ row }) => <span className="whitespace-nowrap tabular-nums text-muted-foreground">{money(row.original.balanceAfter)}</span>,
  },
];

/* ------------------------------------------------------------------ page */

export function CustomerDetailContent({ customer }: { customer: CustomerDetail }) {
  const { handleSuspendCustomer, handleActivateCustomer, handleCloseCustomer } = useCustomerActions();
  const fullName = `${customer.name} ${customer.surname}`.trim() || customer.email;
  const activeServices = customer.services.filter((s) => s.status === "ACTIVE").length;
  const unpaid = customer.invoices.filter((i) => i.status === "PENDING" || i.status === "OVERDUE");
  const openTickets = customer.tickets.filter((t) => t.status !== "CLOSED").length;
  const typeLabel = enumLabel("customerType", customer.customerType ?? "INDIVIDUAL");

  const statusAction =
    customer.status === "ACTIVE" ? (
      <button type="button" className={appButton({ variant: "outline" })} onClick={() => void handleSuspendCustomer(customer.id)}>
        <Ban aria-hidden />
        Askıya al
      </button>
    ) : (
      <button type="button" className={appButton({ variant: "outline" })} onClick={() => void handleActivateCustomer(customer.id)}>
        <CheckCircle aria-hidden />
        Aktif et
      </button>
    );

  return (
    <>
      <AppBreadcrumbLabel segment={customer.id} label={fullName} />

      <PageHeader
        back={{ href: "/yonetim/musteriler", label: "Müşteriler" }}
        eyebrow={`${typeLabel} müşteri${customer.isReseller ? " · Bayi" : ""}`}
        title={fullName}
        description={customer.companyName ?? customer.email}
        meta={
          <>
            <StatusBadge kind="user" status={customer.status} />
            <span>Kayıt {formatDate(customer.createdAt)}</span>
            {customer.lastLoginAt ? <span>Son giriş {formatDateTime(customer.lastLoginAt)}</span> : null}
          </>
        }
        actions={
          <>
            <EditCustomerDialog customer={customer} />
            <a href={`mailto:${customer.email}`} className={appButton({ variant: "outline" })}>
              <Mail aria-hidden />
              E-posta gönder
            </a>
            {statusAction}
            {customer.status !== "CLOSED" ? (
              <button
                type="button"
                className={appButton({ variant: "destructive" })}
                onClick={() => void handleCloseCustomer(customer.id)}
              >
                <XCircle aria-hidden />
                Hesabı kapat
              </button>
            ) : null}
          </>
        }
      />

      <StatGrid columns={4}>
        <StatCard
          label="Bakiye"
          value={money(customer.balance)}
          hint={customer.transactions.length ? `Son hareket ${formatDate(customer.transactions[0].createdAt)}` : "Bakiye hareketi yok"}
          tone={customer.balance < 0 ? "danger" : undefined}
        />
        <StatCard
          label="Hizmetler"
          value={customer.services.length.toLocaleString("tr-TR")}
          hint={`${activeServices} aktif`}
        />
        <StatCard
          label="Ödenmemiş fatura"
          value={unpaid.length.toLocaleString("tr-TR")}
          hint={unpaid.length ? money(unpaid.reduce((s, i) => s + i.totalAmount, 0)) : "Son 10 faturada ödenmemiş yok"}
          tone={unpaid.some((i) => i.status === "OVERDUE") ? "danger" : unpaid.length ? "warning" : undefined}
        />
        <StatCard
          label="Alan adı / SSL"
          value={`${customer.domains.length} / ${customer.sslCount}`}
          hint={openTickets ? `${openTickets} açık destek talebi` : "Açık destek talebi yok"}
        />
      </StatGrid>

      <div className="grid items-start gap-6 lg:grid-cols-3">
        <div className="min-w-0 space-y-6 lg:col-span-2">
          <SectionCard
            title="Hizmetler"
            description={`${customer.services.length} hizmet`}
            flush
            actions={
              <Link href="/yonetim/hizmet-ekle" className={appButton({ variant: "outline", size: "sm" })}>
                <PackagePlus aria-hidden />
                Hizmet ekle
              </Link>
            }
          >
            <DataTable
              framed={false}
              caption="Hizmetler"
              columns={serviceColumns}
              data={customer.services}
              pageSize={5}
              rowHref={(s) => `/yonetim/hizmetler/${s.id}`}
              mobileCard={(s) => (
                <ListRow
                  title={s.productName}
                  subtitle={s.domain || s.label || undefined}
                  trailing={money(s.amount)}
                  meta={
                    <>
                      <StatusBadge kind="service" status={s.status} />
                      <span>{billingPeriodLabel(s.billingPeriod)}</span>
                      <span>Yenileme {formatDate(s.nextDueDate ?? s.expiresAt)}</span>
                    </>
                  }
                />
              )}
              emptyState={<EmptyState compact icon={Package} title="Hizmet yok" description="Bu müşteriye ait hizmet bulunmuyor." />}
            />
          </SectionCard>

          <SectionCard
            title="Faturalar"
            description="Son 10 fatura"
            flush
            actions={
              <Link href="/yonetim/faturalar/olustur" className={appButton({ variant: "outline", size: "sm" })}>
                <FilePlus aria-hidden />
                Fatura oluştur
              </Link>
            }
          >
            <DataTable
              framed={false}
              caption="Faturalar"
              columns={invoiceColumns}
              data={customer.invoices}
              pageSize={0}
              initialSort={[{ id: "createdAt", desc: true }]}
              rowHref={(i) => `/yonetim/faturalar/${i.id}`}
              mobileCard={(i) => (
                <ListRow
                  title={<span className="font-mono text-[13px]">{i.invoiceNumber}</span>}
                  trailing={money(i.totalAmount)}
                  meta={
                    <>
                      <StatusBadge kind="invoice" status={i.status} />
                      <span>Son ödeme {formatDate(i.dueDate)}</span>
                    </>
                  }
                />
              )}
              emptyState={<EmptyState compact icon={FileText} title="Fatura yok" />}
            />
          </SectionCard>

          <SectionCard title="Siparişler" description="Son 10 sipariş" flush>
            <DataTable
              framed={false}
              caption="Siparişler"
              columns={orderColumns}
              data={customer.orders}
              pageSize={0}
              initialSort={[{ id: "createdAt", desc: true }]}
              rowHref={(o) => `/yonetim/siparisler/${o.id}`}
              mobileCard={(o) => (
                <ListRow
                  title={<span className="font-mono text-[13px]">{o.orderNumber}</span>}
                  subtitle={`${o.productName}${o.domain ? ` · ${o.domain}` : ""}`}
                  trailing={money(o.totalAmount)}
                  meta={
                    <>
                      <StatusBadge kind="order" status={o.status} />
                      <span>{formatDate(o.createdAt)}</span>
                    </>
                  }
                />
              )}
              emptyState={<EmptyState compact icon={ShoppingCart} title="Sipariş yok" />}
            />
          </SectionCard>

          <SectionCard title="Destek talepleri" description="Son 5 talep" flush>
            <DataTable
              framed={false}
              caption="Destek talepleri"
              columns={ticketColumns}
              data={customer.tickets}
              pageSize={0}
              initialSort={[{ id: "createdAt", desc: true }]}
              rowHref={(t) => `/yonetim/destek/${t.id}`}
              mobileCard={(t) => (
                <ListRow
                  title={t.subject}
                  subtitle={<span className="font-mono">{t.ticketNumber}</span>}
                  meta={
                    <>
                      <StatusBadge kind="ticket" audience="admin" status={t.status} />
                      <StatusBadge kind="ticketPriority" status={t.priority} />
                      <span>{formatDate(t.createdAt)}</span>
                    </>
                  }
                />
              )}
              emptyState={<EmptyState compact icon={Headphones} title="Destek talebi yok" />}
            />
          </SectionCard>

          <SectionCard id="aktivite" title="Bakiye hareketleri" description="Son 10 hareket" flush>
            <DataTable
              framed={false}
              caption="Bakiye hareketleri"
              columns={transactionColumns}
              data={customer.transactions}
              pageSize={0}
              initialSort={[{ id: "createdAt", desc: true }]}
              mobileCard={(t) => (
                <ListRow
                  title={t.description || enumLabel("transactionType", t.type)}
                  trailing={money(t.amount)}
                  meta={
                    <>
                      <span>{enumLabel("transactionType", t.type)}</span>
                      <span>{formatDateTime(t.createdAt)}</span>
                    </>
                  }
                />
              )}
              emptyState={<EmptyState compact icon={Wallet} title="Bakiye hareketi yok" />}
            />
          </SectionCard>
        </div>

        <div className="min-w-0 space-y-6">
          <SectionCard title="İletişim">
            <DetailList
              items={[
                { label: "E-posta", value: customer.email, copy: customer.email },
                { label: "Telefon", value: customer.phone },
                { label: "Adres", value: customer.address },
                { label: "Şehir", value: [customer.city, customer.country].filter(Boolean).join(", ") },
              ]}
            />
          </SectionCard>

          <SectionCard title="Hesap">
            <DetailList
              items={[
                { label: "Müşteri ID", value: customer.id, mono: true, copy: customer.id },
                { label: "Tip", value: typeLabel },
                { label: "Firma", value: customer.companyName },
                { label: "Vergi no", value: customer.taxNumber, mono: true },
                { label: "Vergi dairesi", value: customer.taxOffice },
                { label: "E-posta doğrulama", value: customer.emailVerifiedAt ? formatDate(customer.emailVerifiedAt) : "Doğrulanmadı", hideEmpty: false },
                { label: "İki adımlı doğrulama", value: customer.twoFactorEnabled ? "Açık" : "Kapalı", hideEmpty: false },
                { label: "Kayıt", value: formatDateTime(customer.createdAt) },
                { label: "Son güncelleme", value: formatDateTime(customer.updatedAt) },
              ]}
            />
          </SectionCard>

          {customer.domains.length ? (
            <SectionCard title="Alan adları" description={`${customer.domains.length} alan adı`} flush>
              <ul className="divide-y">
                {customer.domains.map((d) => (
                  <li key={d.id} className="px-4 py-3 md:px-5">
                    <ListRow
                      leading={<Globe aria-hidden className="mt-0.5 size-4 text-muted-foreground" />}
                      title={d.name}
                      meta={
                        <>
                          <StatusBadge kind="domain" status={d.status} />
                          <span>Bitiş {formatDate(d.expiresAt)}</span>
                        </>
                      }
                    />
                  </li>
                ))}
              </ul>
            </SectionCard>
          ) : null}

          <SectionCard title="Kısayollar" flush>
            <div className="grid gap-1 p-2">
              {[
                { href: "/yonetim/faturalar/olustur", label: "Fatura oluştur", icon: FilePlus },
                { href: "/yonetim/hizmet-ekle", label: "Hizmet ekle", icon: PackagePlus },
                { href: "/yonetim/siparisler/tum-siparisler", label: "Tüm siparişler", icon: Eye },
              ].map((l) => (
                <Link
                  key={l.href}
                  href={l.href}
                  className="flex h-11 items-center gap-2.5 rounded-md px-3 text-sm text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:h-9"
                >
                  <l.icon aria-hidden className="size-4" />
                  {l.label}
                </Link>
              ))}
            </div>
          </SectionCard>
        </div>
      </div>
    </>
  );
}
