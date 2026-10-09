import Link from "next/link";
import { IdCard, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
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
    <section
      role="status"
      aria-label={needsKyc ? "Kimlik doğrulaması gerekli" : "Bekleyen siparişler"}
      className={needsKyc ? "rounded-lg border border-foreground/30 bg-card p-4" : "rounded-lg border border-dashed bg-card p-4"}
    >
      <div className="flex items-start gap-3">
        {needsKyc ? (
          <IdCard aria-hidden className="mt-0.5 size-5 shrink-0 text-foreground" />
        ) : (
          <ShieldAlert aria-hidden className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
        )}
        <div className="min-w-0 flex-1 space-y-2">
          <h2 className="text-sm font-semibold">
            {needsKyc ? "Kimlik doğrulaması gerekli" : "Onay bekleyen siparişleriniz var"}
          </h2>
          {needsKyc ? (
            <p className="text-sm text-muted-foreground">
              Ödemeniz alındı. Sunucu hizmetlerinin kurulumu, 5651 sayılı Kanun gereği kimliğiniz doğrulandıktan sonra
              başlar. Belgelerinizi yükleyin; onaylandığında kurulum kendiliğinden başlar.
            </p>
          ) : null}
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
            <Button asChild size="sm">
              <Link href="/musteri/panel/kimlik-dogrulama">Kimlik belgelerini yükle</Link>
            </Button>
          ) : null}
        </div>
      </div>
    </section>
  );
}
