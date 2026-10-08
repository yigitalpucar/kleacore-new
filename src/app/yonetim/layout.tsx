import type { Metadata } from "next";
import { AdminShell } from "@/components/admin/admin-shell";
import { db } from "@/lib/db";
import { getNotifications } from "@/lib/dal/notifications";
import { requireAdmin } from "@/lib/utils/auth-helpers";

export const metadata: Metadata = {
  title: {
    default: "Yönetim | KLEACORE",
    template: "%s · Yönetim | KLEACORE",
  },
  robots: { index: false, follow: false },
};

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await requireAdmin();
  const user = session.user;

  const [pendingOrders, openTickets, overdueInvoices, pendingCancellations, pendingManualProvisioning, notifications] = await Promise.all([
    db.order.count({ where: { status: "PENDING" } }),
    db.supportTicket.count({ where: { status: { in: ["OPEN", "CUSTOMER_REPLY"] } } }),
    db.invoice.count({ where: { status: "OVERDUE" } }),
    db.cancellationRequest.count({ where: { status: "PENDING" } }),
    db.provisioningJob.count({ where: { kind: "MANUAL", status: { in: ["PENDING", "PROCESSING", "FAILED"] } } }),
    user?.id ? getNotifications(user.id) : Promise.resolve([]),
  ]);

  return (
    <AdminShell
      user={{ name: user?.name || "Yönetici", email: user?.email }}
      counts={{ pendingOrders, openTickets, overdueInvoices, pendingCancellations, pendingManualProvisioning }}
      notifications={notifications.slice(0, 10).map((n) => ({
        id: n.id,
        title: n.title,
        message: n.message,
        createdAt: n.createdAt.toISOString(),
        isRead: n.isRead,
        link: n.link,
        type: n.type,
      }))}
    >
      {children}
    </AdminShell>
  );
}
