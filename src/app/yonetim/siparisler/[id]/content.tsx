"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, CheckCheck, X, XCircle } from "lucide-react";
import { appButton } from "@/components/app";
import { approveOrder, rejectOrder, cancelOrder, completeOrder } from "@/lib/actions/admin/orders";
import { toast } from "@/lib/toast";

interface OrderDetailActionsProps {
  orderId: string;
  status: string;
}

/** Action bar for the order detail header (approve / reject / complete / cancel). */
export function OrderDetailActions({ orderId, status }: OrderDetailActionsProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [activeAction, setActiveAction] = useState<string | null>(null);

  const run = (
    key: string,
    action: () => Promise<{ success: boolean; error?: string }>,
    ok: string,
    fail: string
  ) => {
    setActiveAction(key);
    startTransition(async () => {
      try {
        const result = await action();
        if (!result.success) {
          toast.error(result.error || fail);
          return;
        }
        toast.success(ok);
        router.refresh();
      } finally {
        setActiveAction(null);
      }
    });
  };

  const handleApprove = () => run("approve", () => approveOrder(orderId), "Sipariş onaylandı", "Sipariş onaylanamadı");

  const handleReject = () => {
    const reason = prompt("Ret nedeni:");
    if (!reason?.trim()) return;
    run("reject", () => rejectOrder(orderId, reason.trim()), "Sipariş reddedildi", "Sipariş reddedilemedi");
  };

  const handleCancel = () => {
    const reason = prompt("İptal nedeni:");
    if (!reason?.trim()) return;
    run("cancel", () => cancelOrder(orderId, reason.trim()), "Sipariş iptal edildi", "Sipariş iptal edilemedi");
  };

  const handleComplete = () => run("complete", () => completeOrder(orderId), "Sipariş tamamlandı", "Sipariş tamamlanamadı");

  if (status === "PENDING") {
    return (
      <>
        <button type="button" className={appButton({ variant: "outline" })} disabled={isPending} onClick={handleReject}>
          <X aria-hidden />
          {activeAction === "reject" ? "Reddediliyor…" : "Reddet"}
        </button>
        <button type="button" className={appButton()} disabled={isPending} onClick={handleApprove}>
          <Check aria-hidden />
          {activeAction === "approve" ? "Onaylanıyor…" : "Onayla"}
        </button>
      </>
    );
  }

  if (status === "APPROVED" || status === "PROCESSING") {
    return (
      <>
        <button type="button" className={appButton({ variant: "outline" })} disabled={isPending} onClick={handleCancel}>
          <XCircle aria-hidden />
          {activeAction === "cancel" ? "İptal ediliyor…" : "İptal et"}
        </button>
        <button type="button" className={appButton()} disabled={isPending} onClick={handleComplete}>
          <CheckCheck aria-hidden />
          {activeAction === "complete" ? "Tamamlanıyor…" : "Tamamla"}
        </button>
      </>
    );
  }

  return null;
}
