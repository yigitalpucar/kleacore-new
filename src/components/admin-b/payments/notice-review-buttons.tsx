"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, X } from "lucide-react";
import { appButton } from "@/components/app";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/lib/toast";
import {
  approveBankTransferNoticeAction,
  rejectBankTransferNoticeAction,
} from "@/lib/actions/admin/bank-transfer";

/** Onayla / Reddet for one pending "ödeme bildirimi". */
export function NoticeReviewButtons({
  noticeId,
  invoiceNumber,
  amountLabel,
  amountMismatch,
}: {
  noticeId: string;
  invoiceNumber: string;
  amountLabel: string;
  amountMismatch?: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [rejectOpen, setRejectOpen] = useState(false);
  const [reason, setReason] = useState("");

  const approve = () => {
    const warning = amountMismatch ? "\n\nDikkat: bildirilen tutar fatura bakiyesinden farklı." : "";
    if (!window.confirm(`${invoiceNumber} için ${amountLabel} havale onaylansın mı? Fatura ödendi olarak kapanır.${warning}`)) {
      return;
    }
    startTransition(async () => {
      const result = await approveBankTransferNoticeAction(noticeId);
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success(result.message);
      router.refresh();
    });
  };

  const reject = () => {
    startTransition(async () => {
      const result = await rejectBankTransferNoticeAction(noticeId, reason);
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success(result.message);
      setRejectOpen(false);
      setReason("");
      router.refresh();
    });
  };

  return (
    <div className="flex flex-wrap gap-2">
      <button type="button" disabled={isPending} onClick={approve} className={appButton({ size: "sm" })}>
        <Check aria-hidden />
        Onayla
      </button>
      <button
        type="button"
        disabled={isPending}
        onClick={() => setRejectOpen(true)}
        className={appButton({ variant: "outline", size: "sm" })}
      >
        <X aria-hidden />
        Reddet
      </button>
      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ödeme bildirimini reddet</DialogTitle>
            <DialogDescription>
              {invoiceNumber} · {amountLabel}. Müşteriye ret nedeniyle birlikte bildirim gönderilir; fatura açık kalır.
            </DialogDescription>
          </DialogHeader>
          <label htmlFor={`reject-${noticeId}`} className="text-sm font-medium">
            Ret nedeni
          </label>
          <Textarea
            id={`reject-${noticeId}`}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Ör. hesaba bu tutarda ödeme ulaşmadı"
            className="min-h-20"
            maxLength={500}
          />
          <DialogFooter>
            <button type="button" onClick={() => setRejectOpen(false)} className={appButton({ variant: "outline" })}>
              Vazgeç
            </button>
            <button
              type="button"
              disabled={isPending || reason.trim().length < 3}
              onClick={reject}
              className={appButton({ variant: "destructive" })}
            >
              {isPending ? "Reddediliyor…" : "Reddet"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
