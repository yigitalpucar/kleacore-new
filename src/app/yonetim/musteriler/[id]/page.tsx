import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getCustomerById } from "@/lib/dal/customers";
import { CustomerDetailContent, type CustomerDetail } from "./content";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Müşteri detayı" };

const iso = (d: Date | null | undefined) => (d ? d.toISOString() : null);

export default async function CustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const c = await getCustomerById(id);

  if (!c) return notFound();

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
    balance: Number(c.balance ?? 0),
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
    orders: c.orders.map((o) => ({
      id: o.id,
      orderNumber: o.orderNumber,
      productName: o.product?.name ?? "—",
      domain: o.domain,
      status: o.status,
      totalAmount: Number(o.totalAmount ?? 0),
      createdAt: o.createdAt.toISOString(),
    })),
    invoices: c.invoices.map((i) => ({
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
    transactions: c.transactions.map((t) => ({
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

  return <CustomerDetailContent customer={customer} />;
}
