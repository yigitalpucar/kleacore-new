import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { FileText } from "lucide-react";
import { AppBreadcrumbLabel, DetailList, EmptyState, PageHeader, SectionCard, StatusBadge, enumLabel } from "@/components/app";
import { customerDisplayName, getKycCustomer } from "@/lib/dal/review";
import { formatDate, formatDateTime } from "@/lib/format/date";
import { KYC_DOCUMENT_LABELS } from "@/lib/kyc/documents";
import { getKycConfig } from "@/lib/kyc/settings";
import { HOLD_REASON_LABELS, type HoldReason } from "@/lib/provisioning/hold";
import { requirePermission } from "@/lib/utils/auth-helpers";
import { KycDecisionActions } from "./kyc-actions";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Kimlik doğrulama" };

function fileSize(bytes: number) {
  return bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

export default async function KycCustomerPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePermission("kyc.review");
  const { id } = await params;
  const [user, config] = await Promise.all([getKycCustomer(id), getKycConfig()]);
  if (!user) notFound();

  const name = customerDisplayName(user);
  const liveDocuments = user.kycDocuments.filter((document) => !document.deletedAt);
  const deletedDocuments = user.kycDocuments.filter((document) => document.deletedAt);

  return (
    <>
      <AppBreadcrumbLabel segment={user.id} label={name} />
      <PageHeader
        back={{ href: "/yonetim/kyc", label: "Kimlik doğrulama" }}
        eyebrow="KYC"
        title={name}
        description={user.email}
        meta={
          <>
            <StatusBadge kind="kyc" status={user.kycStatus} size="md" />
            {user.kycSubmittedAt ? <span>Gönderim: {formatDateTime(user.kycSubmittedAt)}</span> : null}
          </>
        }
      />

      <div className="grid items-start gap-6 lg:grid-cols-3">
        <div className="min-w-0 space-y-6 lg:col-span-2">
          <SectionCard
            title="Belgeler"
            description="Görseller yeni sekmede açılır, PDF'ler indirilir. Her görüntüleme aktivite kaydına yazılır."
          >
            {liveDocuments.length === 0 ? (
              <EmptyState compact icon={FileText} title="Belge yok" description="Müşteri henüz belge yüklemedi veya belgeler saklama süresi dolduğu için silindi." />
            ) : (
              <ul className="grid gap-3 sm:grid-cols-2">
                {liveDocuments.map((document) => (
                  <li key={document.id} className="space-y-2 rounded-md border p-3">
                    <p className="text-sm font-medium">{KYC_DOCUMENT_LABELS[document.type]}</p>
                    {document.mimeType.startsWith("image/") ? (
                      <a href={`/api/kyc/documents/${document.id}`} target="_blank" rel="noopener noreferrer" className="block">
                        {/* eslint-disable-next-line @next/next/no-img-element -- private, auth-gated file; no optimiser */}
                        <img
                          src={`/api/kyc/documents/${document.id}`}
                          alt={KYC_DOCUMENT_LABELS[document.type]}
                          className="max-h-56 w-full rounded border object-contain"
                          loading="lazy"
                          referrerPolicy="no-referrer"
                        />
                      </a>
                    ) : (
                      <a href={`/api/kyc/documents/${document.id}`} className="text-sm underline underline-offset-2">
                        PDF&apos;i indir
                      </a>
                    )}
                    <p className="break-all text-xs text-muted-foreground">
                      {document.fileName} · {fileSize(document.sizeBytes)} · {formatDateTime(document.uploadedAt)}
                    </p>
                    {document.deleteAfter ? (
                      <p className="text-xs text-muted-foreground">Silinecek: {formatDate(document.deleteAfter)}</p>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
            {deletedDocuments.length > 0 ? (
              <p className="mt-3 text-xs text-muted-foreground">
                {deletedDocuments.length} eski belge saklama süresi dolduğu için silindi (yalnızca kaydı tutuluyor).
              </p>
            ) : null}
          </SectionCard>

          {user.kycStatus === "PENDING" ? (
            <SectionCard
              title="Karar"
              description="Belgedeki ad / kimlik bilgilerinin hesap bilgileriyle eşleştiğini kontrol edin. Onay, bekleyen sunucu siparişlerinin kurulumunu başlatır."
            >
              <KycDecisionActions userId={user.id} retentionDays={config.rejectedRetentionDays} />
            </SectionCard>
          ) : null}
        </div>

        <div className="space-y-6">
          <SectionCard title="Hesap bilgileri">
            <DetailList
              items={[
                { label: "Ad soyad", value: `${user.name} ${user.surname}`.trim() },
                { label: "Firma", value: user.companyName },
                { label: "Tür", value: enumLabel("customerType", user.customerType) },
                { label: "Vergi / TC no", value: user.taxNumber, mono: true },
                { label: "Vergi dairesi", value: user.taxOffice },
                { label: "Adres", value: [user.address, user.city, user.country].filter(Boolean).join(", ") },
                { label: "Telefon", value: user.phone, mono: true },
                { label: "Kayıt", value: formatDate(user.createdAt) },
                { label: "Son karar", value: user.kycReviewedAt ? formatDateTime(user.kycReviewedAt) : null },
                { label: "Ret nedeni", value: user.kycRejectionReason },
              ]}
            />
            <Link href={`/yonetim/musteriler/${user.id}`} className="mt-3 inline-block text-sm underline underline-offset-2">
              Müşteri kartı
            </Link>
          </SectionCard>

          <SectionCard title="Bekleyen siparişler">
            {user.orders.length === 0 ? (
              <p className="text-sm text-muted-foreground">Kurulumu bekletilen sipariş yok.</p>
            ) : (
              <ul className="space-y-2">
                {user.orders.map((order) => (
                  <li key={order.id} className="text-sm">
                    <Link href={`/yonetim/siparisler/${order.id}`} className="font-mono hover:underline">
                      {order.orderNumber}
                    </Link>{" "}
                    <span className="text-muted-foreground">
                      {order.product.name} · {order.provisioningHoldReasons.map((reason) => HOLD_REASON_LABELS[reason as HoldReason] ?? reason).join(", ")}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>

          <SectionCard title="Açık rıza (KVKK)">
            {user.consentRecords.length === 0 ? (
              <p className="text-sm text-muted-foreground">Kayıt yok.</p>
            ) : (
              <ul className="space-y-2 text-xs text-muted-foreground">
                {user.consentRecords.map((consent) => (
                  <li key={consent.id}>
                    v{consent.documentVersion} · {formatDateTime(consent.acceptedAt)} · IP <span className="font-mono">{consent.ipAddress || "—"}</span>
                    <span className="block break-all font-mono">sha256: {consent.snapshotHash}</span>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>
        </div>
      </div>
    </>
  );
}
