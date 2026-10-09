"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, X } from "lucide-react";
import { FormField, appButton } from "@/components/app";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { approveOrderReviewAction, rejectOrderReviewAction } from "@/lib/actions/admin/fraud-review";
import { toast } from "@/lib/toast";

type RefundMethod = "GATEWAY" | "BALANCE" | "MANUAL";

const REFUND_OPTIONS: Array<{ value: RefundMethod; label: string }> = [
  { value: "GATEWAY", label: "Karta iade (sanal POS)" },
  { value: "BALANCE", label: "Müşteri bakiyesine" },
  { value: "MANUAL", label: "Manuel (havale ile gönderildi)" },
];

/** Approve / reject buttons of the order review card (orders.manage). */
export function OrderReviewActions({ orderId, paid, paidByCard }: { orderId: string; paid: boolean; paidByCard: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [mode, setMode] = useState<"idle" | "reject">("idle");
  const [note, setNote] = useState("");
  const [reason, setReason] = useState("");
  const [refundMethod, setRefundMethod] = useState<RefundMethod>(paidByCard ? "GATEWAY" : "BALANCE");
  const [manualReference, setManualReference] = useState("");

  const finish = (result: { success: true; message: string } | { success: false; error: string }) => {
    if (!result.success) {
      toast.error(result.error);
      return;
    }
    toast.success(result.message);
    setMode("idle");
    router.refresh();
  };

  const approve = () =>
    startTransition(async () => {
      finish(await approveOrderReviewAction(orderId, note));
    });

  const reject = () => {
    if (reason.trim().length < 3) {
      toast.error("Ret nedenini yazın.");
      return;
    }
    startTransition(async () => {
      finish(
        await rejectOrderReviewAction(orderId, {
          reason,
          refundMethod: paid ? refundMethod : undefined,
          manualReference: refundMethod === "MANUAL" ? manualReference : undefined,
        })
      );
    });
  };

  if (mode === "reject") {
    return (
      <div className="space-y-3 rounded-md border border-dashed p-3">
        <FormField label="Ret nedeni (müşteriye iletilir)" htmlFor="reviewRejectReason" required>
          <Textarea id="reviewRejectReason" value={reason} onChange={(event) => setReason(event.target.value)} rows={3} maxLength={1000} />
        </FormField>
        {paid ? (
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">Ödeme iadesi</legend>
            {REFUND_OPTIONS.map((option) => (
              <label key={option.value} className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="refundMethod"
                  value={option.value}
                  checked={refundMethod === option.value}
                  onChange={() => setRefundMethod(option.value)}
                  disabled={option.value === "GATEWAY" && !paidByCard}
                  className="size-4 accent-foreground"
                />
                {option.label}
              </label>
            ))}
            {refundMethod === "MANUAL" ? (
              <FormField label="Havale referansı / dekont no" htmlFor="manualReference">
                <Input id="manualReference" value={manualReference} onChange={(event) => setManualReference(event.target.value)} />
              </FormField>
            ) : null}
          </fieldset>
        ) : (
          <p className="text-xs text-muted-foreground">Ödeme alınmadı: sipariş ve fatura iptal edilir.</p>
        )}
        <div className="flex flex-wrap justify-end gap-2">
          <button type="button" className={appButton({ variant: "ghost" })} onClick={() => setMode("idle")} disabled={pending}>
            Vazgeç
          </button>
          <button type="button" className={appButton({ variant: "destructive" })} onClick={reject} disabled={pending}>
            <X aria-hidden />
            {pending ? "İşleniyor…" : paid ? "Reddet ve iade et" : "Reddet ve iptal et"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <FormField label="Not (isteğe bağlı)" htmlFor="reviewNote">
        <Input id="reviewNote" value={note} onChange={(event) => setNote(event.target.value)} maxLength={1000} placeholder="Ör. müşteriyle telefonda görüşüldü" />
      </FormField>
      <div className="flex flex-wrap justify-end gap-2">
        <button type="button" className={appButton({ variant: "outline" })} onClick={() => setMode("reject")} disabled={pending}>
          <X aria-hidden />
          Reddet
        </button>
        <button type="button" className={appButton({ variant: "primary" })} onClick={approve} disabled={pending}>
          <Check aria-hidden />
          {pending ? "Onaylanıyor…" : paid ? "Onayla ve kurulumu başlat" : "Onayla"}
        </button>
      </div>
    </div>
  );
}
