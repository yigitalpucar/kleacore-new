import { auth } from "@/lib/auth";
import { getCustomerDashboardStats } from "@/lib/dal/dashboard";
import { getServicesByCustomer } from "@/lib/dal/services";
import { DashboardContent } from "./content";

export default async function DashboardPage() {
  const session = await auth();
  const userId = session!.user.id;

  const [dashboardStats, services] = await Promise.all([
    getCustomerDashboardStats(userId),
    getServicesByCustomer(userId),
  ]);

  // Serialize services for the client component
  const serializedServices = services.map((s) => ({
    id: s.id,
    label: s.label,
    domain: s.domain,
    status: s.status,
    nextDueDate: s.nextDueDate ? s.nextDueDate.toISOString() : null,
    product: {
      id: s.product.id,
      name: s.product.name,
    },
  }));

  return (
    <DashboardContent
      stats={{
        activeServices: dashboardStats.activeServices,
        totalInvoices: dashboardStats.totalInvoices,
        unpaidInvoices: dashboardStats.unpaidInvoices,
        openTickets: dashboardStats.openTickets,
      }}
      services={serializedServices}
    />
  );
}
