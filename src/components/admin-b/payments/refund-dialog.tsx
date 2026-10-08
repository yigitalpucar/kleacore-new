"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { RotateCcw } from "lucide-react";
import { appButton } from "@/components/app";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { formatTRY } from "@/lib/format/price";
import { toast } from "@/lib/toast";
import { createRefundAction } from "@/lib/actions/admin/refunds";
import { cn } from "@/lib/utils";

const money = (n: number) => formatTRY(n, { keepDecimals: true });

const GATEWAY_LABELS: Record<string, string> = {
  kuveytturk: "Kuveyt Türk",
  paytr: "PayTR",
  iyzico: "iyzico",
  stripe: "Stripe",
};

type Method = "GATEWAY" | "BALANCE" | "MANUAL";

interface RefundDialogProps {
  invoiceId: string;
  invoiceNumber: string;
  refundable: number;
  cardGateway: string | null;
  hasService: boolean;
}

function newKey() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function parseAmount(text: string) {
  const normalized = text.replace(/\s|₺/g, "").replace(/\.(?=\d{3}(\D|$))/g, "").replace(",", ".");
  const value = Number(normalized);
  return Number.isFinite(value) ? Math.round(value * 100) / 100 : NaN;
}

/** "İade et": amount, reason, method, service option → confirmation step → refund. */
export function RefundDialog({ invoiceId, invoiceNumber, refundable, cardGateway, hasService }: RefundDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [isPending, startTransition] = useTransition();
  // One key per dialog session: a double click or a retry after a network
  // error sends the same key, so the server refunds at most once.
  const [idempotencyKey, setIdempotencyKey] = useState(newKey);
  const [amount, setAmount] = useState(refundable.toFixed(2).replace(".", ","));
  const [reason, setReason] = useState("");
  const [method, setMethod] = useState<Method>(cardGateway ? "GATEWAY" : "BALANCE");
  const [serviceAction, setServiceAction] = useState<"KEEP" | "CANCEL">("KEEP");
  const [manualReference, setManualReference] = useState("");

  const parsedAmount = parseAmount(amount);
  const amountValid = parsedAmount > 0 && parsedAmount <= refundable + 1e-9;
  const isFull = amountValid && Math.abs(parsedAmount - refundable) < 0.005;
  const canContinue = amountValid && reason.trim().length >= 3;

  const methods: Array<{ value: Method; label: string; description: string; disabled?: boolean }> = [
    {
      value: "GATEWAY",
      label: cardGateway ? `Karta iade (${GATEWAY_LABELS[cardGateway] ?? cardGateway})` : "Karta iade",
      description: cardGateway
        ? "Tutar ödemenin alındığı karta geri gönderilir."
        : "Bu fatura kartla ödenmemiş.",
      disabled: !cardGateway,
    },
    {
      value: "BALANCE",
      label: "Bakiyeye aktar",
      description: "Tutar müşterinin hesap bakiyesine eklenir.",
    },
    {
      value: "MANUAL",
      label: "Manuel iade",
      description: "Havale/EFT ile siz gönderdiniz; yalnızca kayıt tutulur.",
    },
  ];

  const reset = () => {
    setConfirming(false);
    setIdempotencyKey(newKey());
    setAmount(refundable.toFixed(2).replace(".", ","));
    setReason("");
    setManualReference("");
    setServiceAction("KEEP");
  };

  const submit = () => {
    startTransition(async () => {
      const result = await createRefundAction({
        invoiceId,
        amount,
        reason,
        method,
        serviceAction,
        idempotencyKey,
        manualReference: method === "MANUAL" ? manualReference : undefined,
      });
      if (!result.success) {
        toast.error(result.error);
        // A definitive failure ends this request; a new attempt gets a new key.
        setIdempotencyKey(newKey());
        setConfirming(false);
        router.refresh();
        return;
      }
      if (result.outcome.status === "PENDING") toast.info(result.message, undefined, 8000);
      else toast.success(result.message);
      setOpen(false);
      reset();
      router.refresh();
    });
  };

  return (
    <>
      <button
        type="button"
        className={appButton({ variant: "outline" })}
        onClick={() => {
          reset();
          setOpen(true);
        }}
      >
        <RotateCcw aria-hidden />
        İade et
      </button>
      <Dialog open={open} onOpenChange={(next) => !isPending && setOpen(next)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{confirming ? "İadeyi onaylayın" : `${invoiceNumber} iadesi`}</DialogTitle>
            <DialogDescription>
              İade edilebilir tutar: <span className="font-medium text-foreground">{money(refundable)}</span>
            </DialogDescription>
          </DialogHeader>

          {confirming ? (
            <div className="space-y-3 text-sm">
              <dl className="space-y-2 rounded-lg border p-3">
                <div className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">Tutar</dt>
                  <dd className="font-medium tabular-nums">
                    {money(parsedAmount)} {isFull ? "(tamamı)" : "(kısmi)"}
                  </dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">Yöntem</dt>
                  <dd>{methods.find((item) => item.value === method)?.label}</dd>
                </div>
                {hasService ? (
                  <div className="flex justify-between gap-4">
                    <dt className="text-muted-foreground">Hizmet</dt>
                    <dd>{serviceAction === "CANCEL" ? "İptal edilecek" : "Açık kalacak"}</dd>
                  </div>
                ) : null}
                <div className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">Neden</dt>
                  <dd className="text-right">{reason}</dd>
                </div>
              </dl>
              <p className="text-muted-foreground">
                {method === "GATEWAY"
                  ? "İade isteği hemen ödeme sağlayıcısına gönderilir ve geri alınamaz."
                  : method === "BALANCE"
                    ? "Tutar müşterinin bakiyesine hemen eklenir."
                    : "İade kaydı oluşturulur; parayı müşteriye sizin göndermiş olmanız gerekir."}{" "}
                Resmi fatura kesildiyse e-Arşiv 7 gün içinde ve tam iadede iptal edilir; aksi halde iade
                faturası gerekli olarak işaretlenir.
              </p>
            </div>
          ) : (
            <div className="space-y-4 text-sm">
              <label className="block space-y-1.5">
                <span className="font-medium">İade tutarı (TL)</span>
                <Input inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} />
                {!amountValid && amount ? (
                  <span className="block text-xs text-red-600 dark:text-red-400">
                    Tutar 0&apos;dan büyük ve en fazla {money(refundable)} olmalı.
                  </span>
                ) : null}
              </label>

              <fieldset className="space-y-2">
                <legend className="font-medium">İade yöntemi</legend>
                {methods.map((option) => (
                  <label
                    key={option.value}
                    className={cn(
                      "flex items-start gap-3 rounded-lg border p-3",
                      option.disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer hover:bg-muted/40",
                      method === option.value && "border-foreground"
                    )}
                  >
                    <input
                      type="radio"
                      name="refund-method"
                      value={option.value}
                      checked={method === option.value}
                      disabled={option.disabled}
                      onChange={() => setMethod(option.value)}
                      className="mt-1"
                    />
                    <span>
                      <span className="block font-medium">{option.label}</span>
                      <span className="block text-xs text-muted-foreground">{option.description}</span>
                    </span>
                  </label>
                ))}
              </fieldset>

              {method === "MANUAL" ? (
                <label className="block space-y-1.5">
                  <span className="font-medium">
                    Dekont / işlem no <span className="font-normal text-muted-foreground">(isteğe bağlı)</span>
                  </span>
                  <Input value={manualReference} onChange={(event) => setManualReference(event.target.value)} />
                </label>
              ) : null}

              {hasService ? (
                <fieldset className="space-y-2">
                  <legend className="font-medium">İlgili hizmet</legend>
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="service-action"
                      checked={serviceAction === "KEEP"}
                      onChange={() => setServiceAction("KEEP")}
                    />
                    Hizmet açık kalsın
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="service-action"
                      checked={serviceAction === "CANCEL"}
                      onChange={() => setServiceAction("CANCEL")}
                    />
                    Hizmeti iptal et (sunucudaki hesap da sonlandırılır)
                  </label>
                </fieldset>
              ) : null}

              <label className="block space-y-1.5">
                <span className="font-medium">İade nedeni</span>
                <Textarea
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  placeholder="Ör. müşteri talebi, mükerrer ödeme"
                  className="min-h-20"
                  maxLength={500}
                />
              </label>
            </div>
          )}

          <DialogFooter>
            {confirming ? (
              <>
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => setConfirming(false)}
                  className={appButton({ variant: "outline" })}
                >
                  Geri
                </button>
                <button
                  type="button"
                  disabled={isPending}
                  onClick={submit}
                  className={appButton({ variant: "destructive" })}
                >
                  {isPending ? "İade ediliyor…" : `${money(parsedAmount)} iade et`}
                </button>
              </>
            ) : (
              <>
                <button type="button" onClick={() => setOpen(false)} className={appButton({ variant: "outline" })}>
                  Vazgeç
                </button>
                <button
                  type="button"
                  disabled={!canContinue}
                  onClick={() => setConfirming(true)}
                  className={appButton()}
                >
                  Devam
                </button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
