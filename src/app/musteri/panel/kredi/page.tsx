import { auth } from "@/lib/auth";
import { getTransactions } from "@/lib/dal/transactions";
import { getCustomerDashboardStats } from "@/lib/dal/dashboard";
import { KrediContent } from "./content";

export default async function KrediPage() {
  const session = await auth();
  const userId = session!.user.id;

  const [transactions, dashboardStats] = await Promise.all([
    getTransactions(userId),
    getCustomerDashboardStats(userId),
  ]);

  const serializedTransactions = transactions.map((t) => ({
    id: t.id,
    type: t.type,
    amount: Number(t.amount),
    balanceBefore: Number(t.balanceBefore),
    balanceAfter: Number(t.balanceAfter),
    description: t.description,
    referenceId: t.referenceId,
    createdAt: t.createdAt.toISOString(),
  }));

  const balance = Number(dashboardStats.balance);

  return (
    <KrediContent
      transactions={serializedTransactions}
      balance={balance}
    />
  );
}
