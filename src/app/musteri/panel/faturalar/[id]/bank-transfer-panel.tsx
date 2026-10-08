"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Clock, Landmark, Loader2, Send } from "lucide-react";
import { CopyButton, appButton } from "@/components/app";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { formatDate } from "@/lib/format/date";
import { formatTRY } from "@/lib/format/price";
import { toast } from "@/lib/toast";
import { submitBankTransferNoticeAction } from "@/lib/actions/customer/bank-transfer";
import type { BankAccountView, BankTransferNoticeView } from "@/lib/dal/bank-transfer";

const money = (n: number) => formatTRY(n, { keepDecimals: true });

function todayInput() {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60_000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 10);
}

interface BankTransferPanelProps {
  invoiceId: string;
  invoiceNumber: string;
  outstanding: number;
  defaultSenderName: string;
  bankAccounts: BankAccountView[];
  notices: BankTransferNoticeView[];
}

/** Havale/EFT: where to send the money, what to write, and the "ödeme bildirimi" form. */
export function BankTransferPanel({
  invoiceId,
  invoiceNumber,
  outstanding,
  defaultSenderName,
  bankAccounts,
  notices,
}: BankTransferPanelProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const pendingNotice = notices.find((notice) => notice.status === "PENDING");
  const lastRejected = !pendingNotice ? notices.find((notice) => notice.status === "REJECTED") : undefined;

  const [form, setForm] = useState({
    amount: outstanding.toFixed(2).replace(".", ","),
    transferDate: todayInput(),
    senderName: defaultSenderName,
    bankAccountId: bankAccounts[0]?.id ?? "",
    note: "",
  });

  const update = (key: keyof typeof form) => (event: { target: { value: string } }) =>
    setForm((current) => ({ ...current, [key]: event.target.value }));

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    startTransition(async () => {
      const result = await submitBankTransferNoticeAction({ invoiceId, ...form });
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success(result.message);
      router.refresh();
    });
  };

  return (
    <div className="space-y-4">
      <div className="rounded-lg border bg-muted/30 p-3 text-sm">
        <p className="font-medium">Açıklama alanına yazın</p>
        <div className="mt-1 flex items-center justify-between gap-2">
          <span className="font-mono text-base tracking-normal">{invoiceNumber}</span>
          <CopyButton value={invoiceNumber} label="Ödeme referansını kopyala" />
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          Gönderilecek tutar: <span className="font-medium text-foreground">{money(outstanding)}</span>. Referans
          olmadan gelen ödemelerin eşleştirilmesi gecikebilir.
        </p>
      </div>

      <ul className="space-y-2" aria-label="Banka hesapları">
        {bankAccounts.map((account) => (
          <li key={account.id} className="rounded-lg border p-3 text-sm">
            <div className="flex items-start gap-2">
              <Landmark aria-hidden className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <p className="font-medium">
                  {account.bankName}
                  {account.branch ? <span className="font-normal text-muted-foreground"> · {account.branch}</span> : null}
                </p>
                <p className="text-muted-foreground">{account.accountName}</p>
                <div className="mt-1 flex items-center justify-between gap-2">
                  <span className="font-mono text-[13px]">{account.ibanFormatted}</span>
                  <CopyButton value={account.iban} label="IBAN'ı kopyala" />
                </div>
                {account.currency !== "TRY" ? (
                  <p className="text-xs text-muted-foreground">Para birimi: {account.currency}</p>
                ) : null}
              </div>
            </div>
          </li>
        ))}
      </ul>

      {pendingNotice ? (
        <div role="status" className="flex items-start gap-3 rounded-lg border border-amber-500/40 p-3 text-sm">
          <Clock aria-hidden className="mt-0.5 size-4 shrink-0 text-amber-500" />
          <div>
            <p className="font-medium">Ödeme bildiriminiz inceleniyor</p>
            <p className="mt-0.5 text-muted-foreground">
              {formatDate(pendingNotice.transferDate)} tarihli {money(pendingNotice.amount)} tutarındaki
              havaleniz kontrol ediliyor. Onaylandığında faturanız kapanır.
            </p>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-3 border-t pt-4" aria-labelledby="notice-title">
          <p id="notice-title" className="text-sm font-medium">
            Ödeme bildirimi
          </p>
          {lastRejected ? (
            <div role="alert" className="flex items-start gap-2 rounded-lg border border-red-500/40 p-3 text-sm">
              <AlertTriangle aria-hidden className="mt-0.5 size-4 shrink-0 text-red-500" />
              <p>
                Önceki bildiriminiz reddedildi
                {lastRejected.rejectionReason ? `: ${lastRejected.rejectionReason}` : "."}
              </p>
            </div>
          ) : null}
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block space-y-1.5 text-sm">
              <span className="font-medium">Ödeme tarihi</span>
              <Input type="date" required value={form.transferDate} max={todayInput()} onChange={update("transferDate")} />
            </label>
            <label className="block space-y-1.5 text-sm">
              <span className="font-medium">Gönderilen tutar (TL)</span>
              <Input inputMode="decimal" required value={form.amount} onChange={update("amount")} />
            </label>
          </div>
          <label className="block space-y-1.5 text-sm">
            <span className="font-medium">Gönderen ad soyad / unvan</span>
            <Input required minLength={3} value={form.senderName} onChange={update("senderName")} autoComplete="name" />
          </label>
          {bankAccounts.length > 1 ? (
            <label className="block space-y-1.5 text-sm">
              <span className="font-medium">Gönderilen hesap</span>
              <select
                value={form.bankAccountId}
                onChange={update("bankAccountId")}
                className="flex h-11 w-full rounded-md border bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:h-9"
              >
                {bankAccounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.bankName} · {account.ibanFormatted.slice(-9)}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          <label className="block space-y-1.5 text-sm">
            <span className="font-medium">
              Not <span className="font-normal text-muted-foreground">(isteğe bağlı)</span>
            </span>
            <Textarea
              rows={2}
              maxLength={500}
              value={form.note}
              onChange={update("note")}
              placeholder="Dekont numarası, işlem saati vb."
            />
          </label>
          <button type="submit" disabled={isPending} className={appButton({ className: "w-full md:h-10" })}>
            {isPending ? <Loader2 aria-hidden className="animate-spin" /> : <Send aria-hidden />}
            {isPending ? "Gönderiliyor…" : "Ödeme bildirimi gönder"}
          </button>
        </form>
      )}
    </div>
  );
}
