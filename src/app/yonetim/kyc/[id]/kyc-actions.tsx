"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, X } from "lucide-react";
import { FormField, appButton } from "@/components/app";
import { Textarea } from "@/components/ui/textarea";
import { approveKycAction, rejectKycAction } from "@/lib/actions/admin/kyc";
import { toast } from "@/lib/toast";

export function KycDecisionActions({ userId, retentionDays }: { userId: string; retentionDays: number }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");

  const finish = (result: { success: true; message: string } | { success: false; error: string }) => {
    if (!result.success) {
      toast.error(result.error);
      return;
    }
    toast.success(result.message);
    setRejecting(false);
    router.refresh();
  };

  if (rejecting) {
    return (
      <div className="space-y-3">
        <FormField
          label="Ret nedeni (müşteriye e-postayla iletilir)"
          htmlFor="kycRejectReason"
          hint={`Belgeler ${retentionDays} gün sonra kalıcı olarak silinir.`}
          required
        >
          <Textarea id="kycRejectReason" rows={3} maxLength={500} value={reason} onChange={(event) => setReason(event.target.value)} />
        </FormField>
        <div className="flex flex-wrap justify-end gap-2">
          <button type="button" className={appButton({ variant: "ghost" })} onClick={() => setRejecting(false)} disabled={pending}>
            Vazgeç
          </button>
          <button
            type="button"
            className={appButton({ variant: "destructive" })}
            disabled={pending}
            onClick={() => startTransition(async () => finish(await rejectKycAction(userId, reason)))}
          >
            <X aria-hidden />
            {pending ? "İşleniyor…" : "Reddet"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap justify-end gap-2">
      <button type="button" className={appButton({ variant: "outline" })} onClick={() => setRejecting(true)} disabled={pending}>
        <X aria-hidden />
        Reddet
      </button>
      <button
        type="button"
        className={appButton({ variant: "primary" })}
        disabled={pending}
        onClick={() => startTransition(async () => finish(await approveKycAction(userId)))}
      >
        <Check aria-hidden />
        {pending ? "Onaylanıyor…" : "Kimliği onayla"}
      </button>
    </div>
  );
}
