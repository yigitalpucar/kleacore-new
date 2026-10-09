import Link from "next/link";
import { ShieldAlert } from "lucide-react";
import { getCustomerWaitingOrders } from "@/lib/dal/review";

/**
 * Customer panel banner: orders whose provisioning waits for the security
 * review or the identity verification (docs/fraud-kyc.md). Renders nothing
 * when there are none.
 */
export async function WaitingOrdersNotice({ userId }: { userId: string }) {
  const orders = await getCustomerWaitingOrders(userId);
  if (orders.length === 0) return null;
  const needsKyc = orders.some((order) => order.waitingForKyc);

  return (
    <section role="status" aria-label="Bekleyen siparişler" className="rounded-lg border border-dashed bg-card p-4">
      <div className="flex items-start gap-3">
        <ShieldAlert aria-hidden className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
        <div className="min-w-0 flex-1 space-y-2">
          <h2 className="text-sm font-semibold">Onay bekleyen siparişleriniz var</h2>
          <ul className="space-y-1 text-sm text-muted-foreground">
            {orders.map((order) => (
              <li key={order.id}>
                <span className="font-mono text-foreground">{order.orderNumber}</span> · {order.productName} —{" "}
                {order.waitingForKyc
                  ? "kimlik doğrulamanız onaylanınca kurulum başlayacak"
                  : order.paymentBlocked
                    ? "güvenlik incelemesinde; onaylanınca ödeme yapabilirsiniz"
                    : order.paid
                      ? "güvenlik incelemesinde; onaylanınca kurulum başlayacak"
                      : "güvenlik incelemesinde"}
              </li>
            ))}
          </ul>
          {needsKyc ? (
            <Link href="/musteri/panel/kimlik-dogrulama" className="inline-block text-sm font-medium underline underline-offset-2">
              Kimlik doğrulamasına git
            </Link>
          ) : null}
        </div>
      </div>
    </section>
  );
}
