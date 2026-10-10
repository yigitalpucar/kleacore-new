import type { Metadata } from "next";
import { CustomerShell } from "@/components/panel/customer-shell";
import { auth } from "@/lib/auth";
import { getCustomerDashboardStats } from "@/lib/dal/dashboard";
import { getBellNotifications } from "@/lib/dal/notifications";
import { isResellerUser } from "@/lib/reseller";
import { isEmailVerified } from "@/lib/auth/email-verification";
import { EmailVerificationBanner } from "@/components/auth/email-verification-banner";

export const metadata: Metadata = {
  title: {
    default: "Müşteri Paneli | KLEACORE",
    template: "%s · Müşteri Paneli | KLEACORE",
  },
  robots: { index: false, follow: false },
};

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  const user = session?.user;
  const userId = user?.id;

  const [isReseller, stats, notifications, emailVerified] = userId
    ? await Promise.all([
        isResellerUser(userId),
        getCustomerDashboardStats(userId),
        getBellNotifications(userId),
        isEmailVerified(userId),
      ])
    : [false, null, { items: [], unread: 0 }, true];

  return (
    <CustomerShell
      user={{ name: user?.name || "Müşteri", email: user?.email }}
      isReseller={isReseller}
      counts={{
        unpaidInvoices: stats?.unpaidInvoices ?? 0,
        openTickets: stats?.openTickets ?? 0,
      }}
      notifications={notifications.items}
      unreadNotifications={notifications.unread}
    >
      {emailVerified ? null : <EmailVerificationBanner email={user?.email} className="mb-6" />}
      {children}
    </CustomerShell>
  );
}
