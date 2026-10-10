import type { Metadata } from "next";
import { AdminShell } from "@/components/admin/admin-shell";
import { db } from "@/lib/db";
import { getBellNotifications } from "@/lib/dal/notifications";
import { requireStaff } from "@/lib/utils/auth-helpers";

export const metadata: Metadata = {
  title: {
    default: "Yönetim | KLEACORE",
    template: "%s · Yönetim | KLEACORE",
  },
  robots: { index: false, follow: false },
};

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  // Any staff role gets in (2FA enforced when require_staff_2fa is on); pages
  // check their own permission and the nav is filtered by role.
  const session = await requireStaff();
  const user = session.user;

  const [
    pendingOrders,
    openTickets,
    overdueInvoices,
    pendingCancellations,
    pendingManualProvisioning,
    pendingBankTransfers,
    notifications,
  ] = await Promise.all([
    db.order.count({ where: { status: "PENDING" } }),
    db.supportTicket.count({ where: { status: { in: ["OPEN", "CUSTOMER_REPLY"] } } }),
    db.invoice.count({ where: { status: "OVERDUE" } }),
    db.cancellationRequest.count({ where: { status: "PENDING" } }),
    db.provisioningJob.count({ where: { kind: "MANUAL", status: { in: ["PENDING", "PROCESSING", "FAILED"] } } }),
    db.bankTransferNotice.count({ where: { status: "PENDING" } }),
    user?.id ? getBellNotifications(user.id) : Promise.resolve({ items: [], unread: 0 }),
  ]);

  return (
    <AdminShell
      user={{ name: user?.name || "Yönetici", email: user?.email }}
      role={user.role}
      counts={{
        pendingOrders,
        openTickets,
        overdueInvoices,
        pendingCancellations,
        pendingManualProvisioning,
        pendingBankTransfers,
      }}
      notifications={notifications.items}
      unreadNotifications={notifications.unread}
    >
      {children}
    </AdminShell>
  );
}
