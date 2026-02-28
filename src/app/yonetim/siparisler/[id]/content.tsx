"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  CheckCircle,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { approveOrder, rejectOrder, cancelOrder, completeOrder } from "@/lib/actions/admin/orders";
import { toast } from "@/lib/toast";

interface OrderDetailActionsProps {
  orderId: string;
  status: string;
}

export function OrderDetailActions({ orderId, status }: OrderDetailActionsProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [activeAction, setActiveAction] = useState<string | null>(null);

  const handleApprove = async () => {
    setActiveAction("approve");
    startTransition(async () => {
      try {
        const result = await approveOrder(orderId);
        if (!result.success) {
          toast.error(result.error || "Sipariş onaylanamadı");
          return;
        }

        toast.success("Sipariş onaylandı");
        router.refresh();
      } finally {
        setActiveAction(null);
      }
    });
  };

  const handleReject = async () => {
    const reason = prompt("Ret nedeni:");
    if (!reason?.trim()) return;

    setActiveAction("reject");
    startTransition(async () => {
      try {
        const result = await rejectOrder(orderId, reason.trim());
        if (!result.success) {
          toast.error(result.error || "Sipariş reddedilemedi");
          return;
        }

        toast.success("Sipariş reddedildi");
        router.refresh();
      } finally {
        setActiveAction(null);
      }
    });
  };

  const handleCancel = async () => {
    const reason = prompt("İptal nedeni:");
    if (!reason?.trim()) return;

    setActiveAction("cancel");
    startTransition(async () => {
      try {
        const result = await cancelOrder(orderId, reason.trim());
        if (!result.success) {
          toast.error(result.error || "Sipariş iptal edilemedi");
          return;
        }

        toast.success("Sipariş iptal edildi");
        router.refresh();
      } finally {
        setActiveAction(null);
      }
    });
  };

  const handleComplete = async () => {
    setActiveAction("complete");
    startTransition(async () => {
      try {
        const result = await completeOrder(orderId);
        if (!result.success) {
          toast.error(result.error || "Sipariş tamamlanamadı");
          return;
        }

        toast.success("Sipariş tamamlandı");
        router.refresh();
      } finally {
        setActiveAction(null);
      }
    });
  };

  return (
    <div className="flex flex-wrap gap-2">
      {status === "PENDING" && (
        <>
          <Button
            className="bg-green-600 hover:bg-green-700"
            disabled={isPending}
            onClick={handleApprove}
          >
            <CheckCircle className="mr-2 h-4 w-4" />
            {activeAction === "approve" ? "Onaylanıyor..." : "Onayla"}
          </Button>
          <Button
            variant="destructive"
            disabled={isPending}
            onClick={handleReject}
          >
            <XCircle className="mr-2 h-4 w-4" />
            {activeAction === "reject" ? "Reddediliyor..." : "Reddet"}
          </Button>
        </>
      )}
      {(status === "APPROVED" || status === "PROCESSING") && (
        <>
          <Button
            className="bg-green-600 hover:bg-green-700"
            disabled={isPending}
            onClick={handleComplete}
          >
            <CheckCircle className="mr-2 h-4 w-4" />
            {activeAction === "complete" ? "Tamamlanıyor..." : "Tamamla"}
          </Button>
          <Button
            variant="outline"
            className="border-red-500 text-red-500 hover:bg-red-500/10"
            disabled={isPending}
            onClick={handleCancel}
          >
            <XCircle className="mr-2 h-4 w-4" />
            {activeAction === "cancel" ? "İptal Ediliyor..." : "İptal Et"}
          </Button>
        </>
      )}
    </div>
  );
}
