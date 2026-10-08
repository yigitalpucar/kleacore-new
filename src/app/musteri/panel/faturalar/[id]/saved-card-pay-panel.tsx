"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CreditCard, Loader2 } from "lucide-react";
import { appButton } from "@/components/app";
import { formatTRY } from "@/lib/format/price";
import { toast } from "@/lib/toast";
import { payInvoiceWithSavedCard } from "@/lib/actions/customer/saved-cards";
import type { SavedCardView } from "@/lib/payments/saved-cards";

interface SavedCardPayPanelProps {
  invoiceId: string;
  outstanding: number;
  cards: SavedCardView[];
}

/** "Kayıtlı kartla öde": charges the outstanding amount from a stored card, no card form. */
export function SavedCardPayPanel({ invoiceId, outstanding, cards }: SavedCardPayPanelProps) {
  const router = useRouter();
  const [cardId, setCardId] = useState(cards.find((card) => card.isDefault)?.id ?? cards[0]?.id ?? "");
  const [paying, setPaying] = useState(false);

  if (cards.length === 0) return null;

  const handlePay = async () => {
    if (paying || !cardId) return;
    const card = cards.find((candidate) => candidate.id === cardId);
    if (!confirm(`${formatTRY(outstanding, { keepDecimals: true })} ${card?.label ?? "kayıtlı kartınızdan"} çekilecek. Onaylıyor musunuz?`)) {
      return;
    }
    setPaying(true);
    try {
      const result = await payInvoiceWithSavedCard({ invoiceId, cardId });
      if (result.success) {
        toast.success(result.message ?? "Ödemeniz alındı");
        router.refresh();
      } else {
        toast.error(result.error);
      }
    } finally {
      setPaying(false);
    }
  };

  return (
    <div className="space-y-2 rounded-lg border p-3">
      <label htmlFor="saved-card-select" className="text-sm font-medium">
        Kayıtlı kartla öde
      </label>
      <select
        id="saved-card-select"
        value={cardId}
        onChange={(event) => setCardId(event.target.value)}
        className="h-11 w-full rounded-md border bg-background px-3 text-sm md:h-9"
      >
        {cards.map((card) => (
          <option key={card.id} value={card.id}>
            {card.label}
            {card.isDefault ? " (varsayılan)" : ""}
          </option>
        ))}
      </select>
      <button
        type="button"
        onClick={handlePay}
        disabled={paying || !cardId}
        className={appButton({ variant: "outline", className: "w-full md:h-10" })}
      >
        {paying ? <Loader2 aria-hidden className="animate-spin" /> : <CreditCard aria-hidden />}
        {paying ? "İşleniyor…" : "Kayıtlı kartla öde"}
      </button>
    </div>
  );
}
