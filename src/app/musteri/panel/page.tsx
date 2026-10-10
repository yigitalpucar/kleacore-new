import type { Metadata } from "next";
import { auth } from "@/lib/auth";
import { getCustomerDashboardStats } from "@/lib/dal/dashboard";
import { getServicesByCustomer } from "@/lib/dal/services";
import { getDomainsByCustomer } from "@/lib/dal/domains";
import { getInvoicesByCustomer } from "@/lib/dal/invoices";
import { getTicketsByCustomer } from "@/lib/dal/tickets";
import { getCustomerOnboarding } from "@/lib/onboarding/customer";
import { DashboardContent } from "./content";
import { WaitingOrdersNotice } from "@/components/panel/waiting-orders-notice";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Genel bakış" };

export default async function DashboardPage() {
  const session = await auth();
  const userId = session!.user.id;

  const [dashboardStats, services, domains, invoices, tickets, onboarding] = await Promise.all([
    getCustomerDashboardStats(userId),
    getServicesByCustomer(userId),
    getDomainsByCustomer(userId),
    getInvoicesByCustomer(userId),
    getTicketsByCustomer(userId),
    getCustomerOnboarding(userId),
  ]);

  return (
    <>
      <WaitingOrdersNotice userId={userId} />
      <DashboardContent
        userName={session!.user.name ?? ""}
        onboarding={onboarding}
        stats={{
          activeServices: dashboardStats.activeServices,
          totalInvoices: dashboardStats.totalInvoices,
          unpaidInvoices: dashboardStats.unpaidInvoices,
          openTickets: dashboardStats.openTickets,
          balance: Number(dashboardStats.balance ?? 0),
        }}
        services={services.map((s) => ({
          id: s.id,
          label: s.label,
          domain: s.domain,
          status: s.status,
          amount: Number(s.amount),
          billingPeriod: s.billingPeriod,
          nextDueDate: s.nextDueDate ? s.nextDueDate.toISOString() : null,
          product: { id: s.product.id, name: s.product.name },
        }))}
        domains={domains.map((d) => ({
          id: d.id,
          name: d.name,
          status: d.status,
          expiresAt: d.expiresAt.toISOString(),
          autoRenew: d.autoRenew,
        }))}
        invoices={invoices.slice(0, 50).map((i) => ({
          id: i.id,
          invoiceNumber: i.invoiceNumber,
          status: i.status,
          totalAmount: Number(i.totalAmount),
          paidAmount: Number(i.paidAmount),
          dueDate: i.dueDate.toISOString(),
          issuedAt: i.issuedAt.toISOString(),
        }))}
        tickets={tickets.slice(0, 50).map((t) => ({
          id: t.id,
          ticketNumber: t.ticketNumber,
          subject: t.subject,
          status: t.status,
          department: t.department,
          updatedAt: t.updatedAt.toISOString(),
        }))}
      />
    </>
  );
}
