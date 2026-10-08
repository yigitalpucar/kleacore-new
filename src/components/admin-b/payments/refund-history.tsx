"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle } from "lucide-react";
import { SectionCard, StatusBadge, appButton, enumLabel } from "@/components/app";
import { formatDateTime } from "@/lib/format/date";
import { formatTRY } from "@/lib/format/price";
import { toast } from "@/lib/toast";
import { resolvePendingRefundAction } from "@/lib/actions/admin/refunds";
import type { InvoiceRefundSummary } from "@/lib/payments/refunds";

const money = (n: number) => formatTRY(n, { keepDecimals: true });

const OPERATION_LABELS: Record<string, string> = {
  SaleReversal: "Aynı gün iptal",
  DrawBack: "Tam iade",
  PartialDrawback: "Kısmi iade",
};

const E_INVOICE_LABELS: Record<string, string> = {
  EARSIV_CANCELLED: "e-Arşiv iptal edildi",
  RETURN_INVOICE_REQUIRED: "İade faturası gerekli",
};

export function RefundHistory({ invoiceId, summary }: { invoiceId: string; summary: InvoiceRefundSummary }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);

  if (summary.refunds.length === 0) return null;

  const resolve = async (refundId: string, outcome: "COMPLETED" | "FAILED") => {
    const question =
      outcome === "COMPLETED"
        ? "Sağlayıcı panelinde iadenin gerçekleştiğini doğruladınız mı? Fatura ve tutarlar güncellenecek."
        : "İade gerçekleşmedi olarak işaretlensin mi? Tutar yeniden iade edilebilir hale gelir.";
    if (!window.confirm(question)) return;
    setBusy(refundId);
    const result = await resolvePendingRefundAction(invoiceId, refundId, outcome);
    setBusy(null);
    if (!result.success) {
      toast.error(result.error);
      return;
    }
    toast.success(result.message);
    router.refresh();
  };

  return (
    <SectionCard title="İadeler" description={`${summary.refunds.length} kayıt`} flush>
      {summary.returnInvoiceRequired ? (
        <div role="alert" className="flex items-start gap-2 border-b px-4 py-3 text-sm md:px-5">
          <AlertTriangle aria-hidden className="mt-0.5 size-4 shrink-0 text-amber-500" />
          <p>
            <span className="font-medium">İade faturası gerekli.</span>{" "}
            <span className="text-muted-foreground">
              Resmi fatura iptal edilemedi veya iade kısmi; müşteri adına iade faturası düzenleyin (otomatik kesilmez).
            </span>
          </p>
        </div>
      ) : null}
      <ul className="divide-y divide-dashed">
        {summary.refunds.map((refund) => (
          <li key={refund.id} className="flex flex-wrap items-start justify-between gap-3 px-4 py-3.5 md:px-5">
            <div className="min-w-0 space-y-1">
              <p className="text-sm font-medium">
                {enumLabel("refundMethod", refund.method)}
                {refund.operation ? ` · ${OPERATION_LABELS[refund.operation] ?? refund.operation}` : null}
              </p>
              <p className="text-xs text-muted-foreground">
                {formatDateTime(refund.completedAt ?? refund.createdAt)}
                {refund.gatewayRef ? (
                  <>
                    {" · "}
                    <span className="font-mono">{refund.gatewayRef}</span>
                  </>
                ) : null}
                {refund.serviceAction === "CANCEL" ? " · Hizmet iptal edildi" : null}
              </p>
              <p className="text-xs text-muted-foreground">{refund.reason}</p>
              {refund.errorMessage ? <p className="text-xs text-red-600 dark:text-red-400">{refund.errorMessage}</p> : null}
              {refund.eInvoiceAction ? (
                <p className="text-xs text-muted-foreground">{E_INVOICE_LABELS[refund.eInvoiceAction] ?? refund.eInvoiceAction}</p>
              ) : null}
              {refund.status === "PENDING" ? (
                <div className="flex flex-wrap gap-2 pt-1">
                  <button
                    type="button"
                    disabled={busy !== null}
                    onClick={() => void resolve(refund.id, "COMPLETED")}
                    className={appButton({ variant: "outline", size: "sm" })}
                  >
                    İade yapıldı
                  </button>
                  <button
                    type="button"
                    disabled={busy !== null}
                    onClick={() => void resolve(refund.id, "FAILED")}
                    className={appButton({ variant: "ghost", size: "sm" })}
                  >
                    İade yapılmadı
                  </button>
                </div>
              ) : null}
            </div>
            <div className="flex flex-col items-end gap-1.5">
              <span className="font-medium tabular-nums">−{money(refund.amount)}</span>
              <StatusBadge kind="refund" status={refund.status} />
            </div>
          </li>
        ))}
      </ul>
    </SectionCard>
  );
}
