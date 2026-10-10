import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getCustomerById } from "@/lib/dal/customers";
import { CustomerDetailContent, type CustomerDetail, type CustomerOverview } from "./content";
import { CustomerTimeline } from "@/components/admin/customer-360/customer-timeline";
import { allowedTimelineKinds, decodeCursor, getCustomerTimeline, parseKinds } from "@/lib/admin/customer-timeline";
import { getCustomerLifetimeRevenue, getCustomerOverdue, getCustomerRisk } from "@/lib/dal/customer-360";
import { requirePermission } from "@/lib/utils/auth-helpers";
import { hasPermission } from "@/lib/auth/permissions";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Müşteri detayı" };

const iso = (d: Date | null | undefined) => (d ? d.toISOString() : null);

export default async function CustomerDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requirePermission("customers.view");
  const role = session.user.role;
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const c = await getCustomerById(id);

  if (!c) return notFound();

  // Customer 360: header figures and the unified timeline, per permission.
  const allowedKinds = allowedTimelineKinds(role);
  const kinds = parseKinds(sp.tur, allowedKinds);
  const cursor = decodeCursor(typeof sp.once === "string" ? sp.once : null);
  const canBilling = hasPermission(role, "invoices.view");
  const [lifetime, overdue, risk, timeline] = await Promise.all([
    canBilling ? getCustomerLifetimeRevenue(id) : null,
    canBilling ? getCustomerOverdue(id) : null,
    hasPermission(role, "orders.view") ? getCustomerRisk(id) : null,
    getCustomerTimeline(id, { kinds, cursor, limit: 20 }),
  ]);

  const customer: CustomerDetail = {
    id: c.id,
    email: c.email,
    name: c.name,
    surname: c.surname,
    phone: c.phone,
    status: c.status,
    customerType: c.customerType,
    companyName: c.companyName,
    taxNumber: c.taxNumber,
    taxOffice: c.taxOffice,
    address: c.address,
    city: c.city,
    country: c.country,
    balance: hasPermission(role, "invoices.view") ? Number(c.balance ?? 0) : 0,
    isReseller: c.isReseller,
    twoFactorEnabled: c.twoFactorEnabled,
    emailVerifiedAt: iso(c.emailVerifiedAt),
    lastLoginAt: iso(c.lastLoginAt),
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
    services: c.services.map((s) => ({
      id: s.id,
      productName: s.product?.name ?? "Hizmet",
      label: s.label,
      domain: s.domain,
      status: s.status,
      billingPeriod: s.billingPeriod,
      amount: Number(s.amount ?? 0),
      nextDueDate: iso(s.nextDueDate),
      expiresAt: iso(s.expiresAt),
    })),
    // Billing/order data only for roles that may see it (e.g. not SUPPORT).
    orders: !hasPermission(role, "orders.view") ? [] : c.orders.map((o) => ({
      id: o.id,
      orderNumber: o.orderNumber,
      productName: o.product?.name ?? "—",
      domain: o.domain,
      status: o.status,
      totalAmount: Number(o.totalAmount ?? 0),
      createdAt: o.createdAt.toISOString(),
    })),
    invoices: !hasPermission(role, "invoices.view") ? [] : c.invoices.map((i) => ({
      id: i.id,
      invoiceNumber: i.invoiceNumber,
      status: i.status,
      totalAmount: Number(i.totalAmount ?? 0),
      dueDate: i.dueDate.toISOString(),
      createdAt: i.createdAt.toISOString(),
    })),
    tickets: c.tickets.map((t) => ({
      id: t.id,
      ticketNumber: t.ticketNumber,
      subject: t.subject,
      status: t.status,
      priority: t.priority,
      createdAt: t.createdAt.toISOString(),
    })),
    transactions: !hasPermission(role, "invoices.view") ? [] : c.transactions.map((t) => ({
      id: t.id,
      type: t.type,
      amount: Number(t.amount ?? 0),
      balanceAfter: Number(t.balanceAfter ?? 0),
      description: t.description,
      createdAt: t.createdAt.toISOString(),
    })),
    domains: c.domains.map((d) => ({ id: d.id, name: d.name, status: d.status, expiresAt: d.expiresAt.toISOString() })),
    sslCount: c.sslCertificates.length,
  };

  const overview: CustomerOverview = {
    lifetime,
    overdue,
    risk,
    kycStatus: c.kycStatus,
    kycSubmittedAt: iso(c.kycSubmittedAt),
  };

  return (
    <CustomerDetailContent
      customer={customer}
      role={role}
      overview={overview}
      timeline={
        <CustomerTimeline
          basePath={`/yonetim/musteriler/${id}`}
          allowed={allowedKinds}
          active={kinds}
          events={timeline.events}
          next={timeline.next}
          paged={Boolean(cursor)}
        />
      }
    />
  );
}
