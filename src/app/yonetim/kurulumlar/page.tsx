import type { Metadata } from "next";
import { getManualProvisioningCounts, getManualProvisioningTasks } from "@/lib/dal/manual-provisioning";
import { getManualSlaHours } from "@/lib/provisioning/manual";
import { KurulumlarContent } from "./content";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Kurulum görevleri" };

function customerName(customer: { name: string; surname: string; companyName: string | null; email: string }) {
  return customer.companyName || `${customer.name} ${customer.surname}`.trim() || customer.email;
}

export default async function KurulumlarPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const tab = sp.status === "COMPLETED" ? "COMPLETED" : "PENDING";
  const [tasks, counts, slaHours] = await Promise.all([
    getManualProvisioningTasks(tab === "COMPLETED" ? ["COMPLETED"] : ["PENDING", "PROCESSING", "FAILED"]),
    getManualProvisioningCounts(),
    getManualSlaHours(),
  ]);
  const now = Date.now();

  return (
    <KurulumlarContent
      tab={tab}
      counts={counts}
      slaHours={slaHours}
      tasks={tasks.map((task) => ({
        id: task.id,
        status: task.status,
        orderId: task.order.id,
        orderNumber: task.order.orderNumber,
        productName: task.order.product.name,
        categoryName: task.order.product.category.name,
        domain: task.service?.domain ?? task.order.domain ?? null,
        customerId: task.order.customer.id,
        customerName: customerName(task.order.customer),
        createdAt: task.createdAt.toISOString(),
        completedAt: task.completedAt?.toISOString() ?? null,
        waitingMs: (task.completedAt?.getTime() ?? now) - task.createdAt.getTime(),
      }))}
    />
  );
}
