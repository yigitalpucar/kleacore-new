import type { Metadata } from "next";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  AUTO_PAY_CONSENT_TEXT,
  SAVED_CARD_CONSENT_TEXT,
  getSavedCardAvailability,
  listCustomerSavedCards,
} from "@/lib/payments/saved-cards";
import { KayitliKartlarContent, type CardNotice } from "./content";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Kayıtlı kartlarım" };

interface PageProps {
  searchParams: Promise<{ kart?: string }>;
}

async function buildNotice(outcome: string | undefined, userId: string): Promise<CardNotice | null> {
  if (outcome === "basarisiz") {
    return {
      tone: "error",
      title: "Kart kaydedilemedi",
      message: "Kart doğrulaması tamamlanmadı. Kartınızdan çekim yapıldıysa 1,00 TL iade edilir; tekrar deneyebilirsiniz.",
    };
  }
  if (outcome === "dogrulaniyor") {
    const pending = await db.savedCard.count({
      where: { userId, status: "PENDING", createdAt: { gte: new Date(Date.now() - 30 * 60 * 1000) } },
    });
    return pending > 0
      ? {
          tone: "warning",
          title: "Kartınız doğrulanıyor",
          message: "Ödeme kuruluşunun onayı bekleniyor. Birkaç saniye sonra sayfayı yenileyin.",
        }
      : { tone: "success", title: "Kart kaydedildi", message: "Doğrulama için alınan 1,00 TL kartınıza iade edilir." };
  }
  return null;
}

export default async function KayitliKartlarPage({ searchParams }: PageProps) {
  const { kart } = await searchParams;
  const session = await auth();
  const userId = session!.user.id;

  const [cards, availability, user, notice] = await Promise.all([
    listCustomerSavedCards(userId),
    getSavedCardAvailability(),
    db.user.findUnique({ where: { id: userId }, select: { autoPayEnabled: true, autoPayConsentAt: true } }),
    buildNotice(kart, userId),
  ]);

  return (
    <KayitliKartlarContent
      cards={cards}
      available={availability.available}
      autoPayEnabled={user?.autoPayEnabled ?? false}
      autoPayConsentAt={user?.autoPayConsentAt?.toISOString() ?? null}
      maxAttempts={availability.settings.maxAttempts}
      consentText={SAVED_CARD_CONSENT_TEXT}
      autoPayConsentText={AUTO_PAY_CONSENT_TEXT}
      notice={notice}
    />
  );
}
