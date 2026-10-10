"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Check, CreditCard, Loader2, Plus, Star, Trash2 } from "lucide-react";
import {
  IconTile,
  PageHeader,
  SectionCard,
  StatusBadge,
  appButton,
} from "@/components/app";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { formatDate } from "@/lib/format/date";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";
import {
  makeSavedCardDefault,
  removeSavedCard,
  startAddSavedCard,
  updateAutoPay,
} from "@/lib/actions/customer/saved-cards";
import type { SavedCardView } from "@/lib/payments/saved-cards";
import { PanelEmptyState } from "@/components/panel/panel-empty-state";

export interface CardNotice {
  tone: "success" | "warning" | "error";
  title: string;
  message: string;
}

interface Props {
  cards: SavedCardView[];
  available: boolean;
  autoPayEnabled: boolean;
  autoPayConsentAt: string | null;
  maxAttempts: number;
  consentText: string;
  autoPayConsentText: string;
  notice: CardNotice | null;
}

function expiryLabel(card: SavedCardView) {
  if (!card.expMonth || !card.expYear) return "—";
  return `${String(card.expMonth).padStart(2, "0")}/${String(card.expYear).slice(-2)}`;
}

function CardStatus({ card }: { card: SavedCardView }) {
  if (card.status === "EXPIRED") return <StatusBadge tone="danger" label="Süresi doldu" />;
  if (card.expiringSoon) return <StatusBadge tone="warning" label="Süresi doluyor" />;
  if (card.requireCvv) return <StatusBadge tone="muted" label="CVV ister" />;
  return <StatusBadge tone="success" label="Geçerli" />;
}

export function KayitliKartlarContent({
  cards,
  available,
  autoPayEnabled,
  autoPayConsentAt,
  maxAttempts,
  consentText,
  autoPayConsentText,
  notice,
}: Props) {
  const router = useRouter();
  const [consent, setConsent] = useState(false);
  const [autoPayConsent, setAutoPayConsent] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const activeCards = cards.filter((card) => card.status === "ACTIVE");
  const defaultCard = activeCards.find((card) => card.isDefault) ?? null;

  const run = async (key: string, action: () => Promise<{ success: boolean; message?: string; error?: string }>) => {
    if (busy) return;
    setBusy(key);
    try {
      const result = await action();
      if (result.success) {
        if (result.message) toast.success(result.message);
        router.refresh();
      } else {
        toast.error(result.error ?? "İşlem tamamlanamadı");
      }
    } finally {
      setBusy(null);
    }
  };

  const handleAdd = async () => {
    if (busy) return;
    if (!consent) {
      toast.error("Kartı kaydetmek için onay kutusunu işaretleyin");
      return;
    }
    setBusy("add");
    const result = await startAddSavedCard({ consent: true });
    if (result.success && result.data) {
      router.push(`/musteri/panel/kayitli-kartlar/ekle?ref=${encodeURIComponent(result.data.ref)}`);
      return;
    }
    setBusy(null);
    toast.error(result.success ? "Kart ekleme başlatılamadı" : result.error);
  };

  const handleDelete = (card: SavedCardView) => {
    const warning =
      card.isDefault && autoPayEnabled && activeCards.length === 1
        ? " Bu kart otomatik ödemede kullanılan tek kartınız; silerseniz otomatik ödeme kapanır."
        : "";
    if (!confirm(`${card.label} kartını silmek istediğinize emin misiniz?${warning}`)) return;
    void run(`delete:${card.id}`, () => removeSavedCard({ cardId: card.id }));
  };

  const handleAutoPay = (enabled: boolean) => {
    if (enabled && !autoPayConsent) {
      toast.error("Otomatik ödemeyi açmak için onay kutusunu işaretleyin");
      return;
    }
    void run("autopay", () => updateAutoPay({ enabled, consent: enabled ? autoPayConsent : undefined }));
  };

  return (
    <>
      <PageHeader
        title="Kayıtlı kartlarım"
        description="Kartlarınız ödeme kuruluşu PayTR'de saklanır; KLEACORE kart numaranızı veya güvenlik kodunu saklamaz."
      />

      {notice ? (
        <div
          role={notice.tone === "success" ? "status" : "alert"}
          className="flex items-start gap-3 rounded-xl border bg-card px-4 py-3 text-sm"
        >
          {notice.tone === "success" ? (
            <Check aria-hidden className="mt-0.5 size-4 shrink-0 text-emerald-500" />
          ) : (
            <AlertTriangle
              aria-hidden
              className={cn("mt-0.5 size-4 shrink-0", notice.tone === "error" ? "text-red-500" : "text-amber-500")}
            />
          )}
          <div>
            <p className="font-medium">{notice.title}</p>
            <p className="mt-0.5 text-muted-foreground">{notice.message}</p>
          </div>
        </div>
      ) : null}

      <div className="grid items-start gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <SectionCard title="Kartlar" flush>
            {cards.length === 0 ? (
              <div className="p-4">
                <PanelEmptyState kind="savedCards" compact />
              </div>
            ) : (
              <ul className="divide-y">
                {cards.map((card) => (
                  <li key={card.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                    <IconTile size="sm">
                      <CreditCard aria-hidden className="size-4" />
                    </IconTile>
                    <div className="min-w-0 flex-1">
                      <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
                        <span className="font-mono">{card.label}</span>
                        {card.isDefault ? <StatusBadge tone="info" label="Varsayılan" size="sm" /> : null}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        SKT {expiryLabel(card)}
                        {card.bankName ? ` · ${card.bankName}` : ""} · Eklenme {formatDate(card.createdAt)}
                      </p>
                    </div>
                    <CardStatus card={card} />
                    <div className="flex items-center gap-2">
                      {!card.isDefault && card.status === "ACTIVE" ? (
                        <button
                          type="button"
                          onClick={() => void run(`default:${card.id}`, () => makeSavedCardDefault({ cardId: card.id }))}
                          disabled={busy !== null}
                          className={appButton({ variant: "outline", size: "sm" })}
                        >
                          {busy === `default:${card.id}` ? (
                            <Loader2 aria-hidden className="size-4 animate-spin" />
                          ) : (
                            <Star aria-hidden className="size-4" />
                          )}
                          Varsayılan yap
                        </button>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => handleDelete(card)}
                        disabled={busy !== null}
                        aria-label={`${card.label} kartını sil`}
                        className={appButton({ variant: "ghost", size: "icon-sm" })}
                      >
                        {busy === `delete:${card.id}` ? (
                          <Loader2 aria-hidden className="size-4 animate-spin" />
                        ) : (
                          <Trash2 aria-hidden className="size-4" />
                        )}
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>

          {available ? (
            <SectionCard
              title="Kart ekle"
              description="Kartınız 3D Secure ile doğrulanır: 1,00 TL çekilir ve hemen iade edilir."
            >
              <div className="space-y-4">
                <label htmlFor="card-consent" className="flex items-start gap-3 text-sm leading-relaxed">
                  <Checkbox
                    id="card-consent"
                    checked={consent}
                    onCheckedChange={(value) => setConsent(value === true)}
                    className="mt-0.5"
                  />
                  <span className="text-muted-foreground">{consentText}</span>
                </label>
                <button
                  type="button"
                  onClick={handleAdd}
                  disabled={!consent || busy !== null}
                  className={appButton({ variant: "primary" })}
                >
                  {busy === "add" ? <Loader2 aria-hidden className="size-4 animate-spin" /> : <Plus aria-hidden className="size-4" />}
                  Kart ekle
                </button>
              </div>
            </SectionCard>
          ) : (
            <SectionCard title="Kart ekle">
              <p className="text-sm text-muted-foreground">Kart kaydetme şu anda kullanılamıyor.</p>
            </SectionCard>
          )}
        </div>

        <SectionCard
          title="Otomatik ödeme"
          description={`Vadesi gelen faturalar varsayılan kartınızdan çekilir. Çekim başarısız olursa e-posta ile bilgilendirilirsiniz; en fazla ${maxAttempts} gün denenir.`}
        >
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <label htmlFor="auto-pay" className="text-sm font-medium">
                {autoPayEnabled ? "Açık" : "Kapalı"}
              </label>
              <Switch
                id="auto-pay"
                checked={autoPayEnabled}
                disabled={busy !== null || (!autoPayEnabled && (!available || !defaultCard))}
                onCheckedChange={(value) => handleAutoPay(value)}
              />
            </div>
            {autoPayEnabled ? (
              <p className="text-xs text-muted-foreground">
                {defaultCard ? `Kullanılan kart: ${defaultCard.label}.` : "Varsayılan kart yok."}
                {autoPayConsentAt ? ` Onay tarihi: ${formatDate(autoPayConsentAt)}.` : ""}
              </p>
            ) : defaultCard && available ? (
              <label htmlFor="auto-pay-consent" className="flex items-start gap-3 text-xs leading-relaxed">
                <Checkbox
                  id="auto-pay-consent"
                  checked={autoPayConsent}
                  onCheckedChange={(value) => setAutoPayConsent(value === true)}
                  className="mt-0.5"
                />
                <span className="text-muted-foreground">{autoPayConsentText}</span>
              </label>
            ) : (
              <p className="text-xs text-muted-foreground">Otomatik ödeme için önce bir kart ekleyin.</p>
            )}
          </div>
        </SectionCard>
      </div>
    </>
  );
}
