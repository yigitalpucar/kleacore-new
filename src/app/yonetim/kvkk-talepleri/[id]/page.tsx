import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AppBreadcrumbLabel, DetailList, PageHeader, SectionCard, StatusBadge } from "@/components/app";
import { getDataRequestDetail } from "@/lib/dal/privacy";
import { formatDateTime } from "@/lib/format/date";
import {
  DATA_REQUEST_STATUS_TONES,
  dataRequestStatusLabel,
  dataRequestTypeLabel,
  deadlineState,
  isOpenDataRequestStatus,
  type DataRequestStatusValue,
  type DataRequestTypeValue,
} from "@/lib/privacy/labels";
import { requirePermission } from "@/lib/utils/auth-helpers";
import { DataRequestActions } from "./actions";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "KVKK başvurusu" };

export default async function KvkkTalebiPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePermission("privacy.manage");
  const { id } = await params;
  const request = await getDataRequestDetail(id);
  if (!request) notFound();

  const deadline = deadlineState(request);
  const open = isOpenDataRequestStatus(request.status);

  return (
    <>
      <AppBreadcrumbLabel segment={request.id} label={request.requestNumber} />
      <PageHeader
        title={`${request.requestNumber} · ${dataRequestTypeLabel(request.type)}`}
        back={{ href: "/yonetim/kvkk-talepleri", label: "KVKK talepleri" }}
        meta={
          <div className="flex flex-wrap gap-2">
            <StatusBadge
              tone={DATA_REQUEST_STATUS_TONES[request.status as DataRequestStatusValue] ?? "muted"}
              label={dataRequestStatusLabel(request.status)}
            />
            {deadline.kind === "open" ? <StatusBadge tone={deadline.tone} label={deadline.label} /> : null}
          </div>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <div className="space-y-6">
          <SectionCard title="Başvuru">
            <DetailList
              items={[
                { label: "Başvuran", value: request.name },
                { label: "E-posta", value: request.email, mono: true, copy: request.email },
                { label: "Telefon", value: request.phone ?? "" },
                {
                  label: "Hesap",
                  value: request.user ? (
                    <Link href={`/yonetim/musteriler/${request.user.id}`} className="underline underline-offset-4">
                      {`${request.user.name} ${request.user.surname}`.trim() || request.user.email}
                    </Link>
                  ) : (
                    "Bu e-posta ile hesap bulunamadı"
                  ),
                },
                { label: "Kaynak", value: request.source === "panel" ? "Müşteri paneli (oturum açık)" : "Herkese açık form (e-posta doğrulamalı)" },
                { label: "Oluşturuldu", value: formatDateTime(request.createdAt) },
                { label: "Doğrulandı", value: request.verifiedAt ? formatDateTime(request.verifiedAt) : "" },
                { label: "Son tarih", value: request.dueAt ? formatDateTime(request.dueAt) : "" },
                { label: "Sonuçlandı", value: request.completedAt ? formatDateTime(request.completedAt) : "" },
                { label: "IP", value: request.ipAddress ?? "", mono: true },
              ]}
            />
            <div className="mt-4 space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground">Açıklama</p>
              <p className="whitespace-pre-line rounded-md border bg-muted/30 px-3 py-2 text-sm">{request.details}</p>
            </div>
            {request.responseText ? (
              <div className="mt-4 space-y-1.5">
                <p className="text-xs font-medium text-muted-foreground">Gönderilen yanıt</p>
                <p className="whitespace-pre-line rounded-md border px-3 py-2 text-sm">{request.responseText}</p>
              </div>
            ) : null}
          </SectionCard>
        </div>

        <DataRequestActions
          request={{
            id: request.id,
            type: request.type as DataRequestTypeValue,
            status: request.status,
            open,
            hasAccount: Boolean(request.userId),
            exportCreatedAt: request.exportCreatedAt?.toISOString() ?? null,
            exportSizeBytes: request.exportSizeBytes,
            exportReady: Boolean(request.exportStorageKey) && !request.exportDownloadedAt,
            exportDownloadedAt: request.exportDownloadedAt?.toISOString() ?? null,
            exportExpiresAt: request.exportExpiresAt?.toISOString() ?? null,
            anonymizedAt: request.anonymizedAt?.toISOString() ?? null,
          }}
          notes={request.notes.map((note) => ({
            id: note.id,
            authorName: note.authorName,
            body: note.body,
            createdAt: note.createdAt.toISOString(),
          }))}
        />
      </div>
    </>
  );
}
