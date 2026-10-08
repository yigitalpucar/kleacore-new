import type { Metadata } from "next";
import Link from "next/link";
import { CreditCard } from "lucide-react";
import { EmptyState, PageHeader, appButton } from "@/components/app";
import { auth } from "@/lib/auth";
import { getRequestMeta } from "@/lib/request-meta";
import { SAVED_CARDS_PATH, loadCardVerificationForm } from "@/lib/payments/saved-cards";
import { SavedCardForm } from "./card-form";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Kart ekle" };

interface PageProps {
  searchParams: Promise<{ ref?: string }>;
}

export default async function KartEklePage({ searchParams }: PageProps) {
  const { ref = "" } = await searchParams;
  const session = await auth();
  const meta = await getRequestMeta();
  const form = ref ? await loadCardVerificationForm(session!.user.id, ref, meta.ip) : null;

  return (
    <>
      <PageHeader
        title="Kart ekle"
        back={{ href: SAVED_CARDS_PATH, label: "Kayıtlı kartlarım" }}
        description="Kart bilgileriniz doğrudan PayTR'ye gönderilir; KLEACORE sunucularına ulaşmaz."
      />
      {form ? (
        <div className="max-w-xl">
          <SavedCardForm action={form.action} fields={form.fields} amountLabel={form.amountLabel} />
        </div>
      ) : (
        <EmptyState
          icon={CreditCard}
          title="Kart ekleme oturumu bulunamadı"
          description="Oturumun süresi dolmuş olabilir. Kayıtlı kartlarım sayfasından yeniden başlatın."
          action={
            <Link href={SAVED_CARDS_PATH} className={appButton({ variant: "outline" })}>
              Kayıtlı kartlarım
            </Link>
          }
        />
      )}
    </>
  );
}
