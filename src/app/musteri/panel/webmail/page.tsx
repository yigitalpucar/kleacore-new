import { auth } from "@/lib/auth";
import {
  getEmailAccountsByCustomer,
  getEmailAccountStats,
  getEmailDomainsByCustomer,
} from "@/lib/dal/webmail";
import { WebmailContent } from "./content";

export const dynamic = "force-dynamic";

export default async function WebmailPage() {
  const session = await auth();
  const userId = session!.user.id;

  const [emailAccounts, domains, stats] = await Promise.all([
    getEmailAccountsByCustomer(userId),
    getEmailDomainsByCustomer(userId),
    getEmailAccountStats(userId),
  ]);

  const statusMap = {
    ACTIVE: "active",
    SUSPENDED: "suspended",
    CLOSED: "closed",
  } as const;

  const serializedAccounts = emailAccounts.map((account) => ({
    id: account.id,
    email: account.email,
    domain:
      account.domain?.name ??
      account.email.split("@")[1] ??
      "",
    quota: account.quotaMb,
    used: account.usedMb,
    status: statusMap[account.status],
    forwardTo: account.forwardTo,
    autoResponder: account.autoResponder,
    createdAt: account.createdAt.toISOString(),
    lastLogin: account.lastLoginAt
      ? account.lastLoginAt.toLocaleDateString("tr-TR", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
        })
      : null,
  }));

  return (
    <WebmailContent
      emailAccounts={serializedAccounts}
      domains={domains}
      stats={stats}
    />
  );
}
