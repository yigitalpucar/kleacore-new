import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AppBreadcrumbLabel, DetailList, EmptyState, PageHeader, SectionCard, StatusBadge } from "@/components/app";
import { domainEventState, getDomainEventById } from "@/lib/dal/domain-events";
import { eventLabel, isEventType } from "@/lib/events/catalog";
import { subscribersFor } from "@/lib/events/subscribers";
import { formatDateTime } from "@/lib/format/date";
import { RedeliverButton } from "../redeliver-button";
import { DELIVERY_STATUS_META, EVENT_STATE_META, SUBSCRIBER_LABELS } from "../state";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Olay detayı" };

/** Admin links for the aggregate, when a page exists for it. */
function aggregateHref(type: string, id: string) {
  switch (type) {
    case "Invoice":
      return `/yonetim/faturalar/${id}`;
    case "Service":
      return `/yonetim/hizmetler/${id}`;
    case "Order":
      return `/yonetim/siparisler/${id}`;
    case "Ticket":
      return `/yonetim/destek/${id}`;
    case "User":
      return `/yonetim/musteriler/${id}`;
    default:
      return null;
  }
}

export default async function OlayDetayPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const event = await getDomainEventById(id);
  if (!event) notFound();

  const state = domainEventState(event);
  const stateMeta = EVENT_STATE_META[state];
  const expected = isEventType(event.type) ? subscribersFor(event.type).map((subscriber) => subscriber.name) : [];
  const recorded = new Map(event.deliveries.map((delivery) => [delivery.subscriber, delivery]));
  const rows = [...new Set([...expected, ...recorded.keys()])].map((name) => ({ name, delivery: recorded.get(name) ?? null }));
  const href = aggregateHref(event.aggregateType, event.aggregateId);

  return (
    <>
      <AppBreadcrumbLabel segment={event.id} label={eventLabel(event.type)} />
      <PageHeader
        back={{ href: "/yonetim/olaylar", label: "Olaylar" }}
        eyebrow={event.aggregateType}
        title={eventLabel(event.type)}
        meta={
          <>
            <StatusBadge tone={stateMeta.tone} label={stateMeta.label} size="md" />
            <span className="font-mono">{event.type}</span>
          </>
        }
        actions={
          state !== "PROCESSED" ? (
            <RedeliverButton eventId={event.id} variant="primary" />
          ) : undefined
        }
      />

      <div className="grid items-start gap-6 lg:grid-cols-3">
        <div className="min-w-0 space-y-6 lg:col-span-2">
          <SectionCard
            title="Abonelere dağıtım"
            description="Her abone olayı en fazla bir kez işler; başarısız olan abone tek başına yeniden denenir."
            flush
          >
            {rows.length === 0 ? (
              <EmptyState compact title="Bu olayın abonesi yok" description="Olay yalnızca kayıt için tutulur." />
            ) : (
              <ul className="divide-y">
                {rows.map(({ name, delivery }) => {
                  const meta = delivery
                    ? (DELIVERY_STATUS_META[delivery.status] ?? { label: delivery.status, tone: "neutral" as const })
                    : { label: "Henüz çalışmadı", tone: "muted" as const };
                  return (
                    <li key={name} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0 space-y-1">
                        <p className="font-medium">{SUBSCRIBER_LABELS[name] ?? name}</p>
                        <p className="font-mono text-xs text-muted-foreground">{name}</p>
                        <div className="flex flex-wrap items-center gap-2 pt-1">
                          <StatusBadge tone={meta.tone} label={meta.label} />
                          {delivery ? (
                            <span className="text-xs text-muted-foreground">
                              {delivery.attempts} deneme
                              {delivery.deliveredAt ? ` · ${formatDateTime(delivery.deliveredAt)}` : ""}
                            </span>
                          ) : null}
                        </div>
                        {delivery?.lastError ? (
                          <p className="break-words text-xs text-muted-foreground">{delivery.lastError}</p>
                        ) : null}
                        {delivery?.result ? (
                          <pre className="max-w-full overflow-x-auto whitespace-pre-wrap break-all rounded-md bg-muted/50 p-2 font-mono text-[11px] text-muted-foreground">
                            {JSON.stringify(delivery.result, null, 2)}
                          </pre>
                        ) : null}
                      </div>
                      {delivery ? (
                        <RedeliverButton
                          eventId={event.id}
                          subscriber={name}
                          label="Bu aboneyi yeniden çalıştır"
                          variant="ghost"
                          confirmText={
                            delivery.status === "DELIVERED"
                              ? "Bu abone olayı zaten işledi. Yeniden çalıştırılsın mı? (Bildirimler tekil anahtarla korunur; webhook yeniden gönderilir.)"
                              : undefined
                          }
                        />
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            )}
          </SectionCard>

          <SectionCard title="Veri" description="Gizli alanlar (ör. ilk şifre) şifreli saklanır ve burada gösterilmez.">
            <pre className="max-w-full overflow-x-auto whitespace-pre-wrap break-all font-mono text-xs leading-relaxed">
              {JSON.stringify(event.payload, null, 2)}
            </pre>
          </SectionCard>
        </div>

        <SectionCard title="Kayıt">
          <DetailList
            items={[
              { label: "Olay no", value: event.id, mono: true, copy: event.id },
              {
                label: "Kayıt",
                value: href ? (
                  <Link href={href} className="font-mono hover:underline">
                    {event.aggregateId}
                  </Link>
                ) : (
                  event.aggregateId
                ),
                mono: !href,
              },
              {
                label: "İşlemi yapan",
                value: event.actor
                  ? `${`${event.actor.name ?? ""} ${event.actor.surname ?? ""}`.trim() || event.actor.email}${event.actor.role === "ADMIN" ? " (yönetici)" : ""}`
                  : "Sistem",
              },
              { label: "Oluştu", value: formatDateTime(event.occurredAt) },
              { label: "Dağıtıldı", value: event.processedAt ? formatDateTime(event.processedAt) : null },
              { label: "Deneme", value: String(event.attempts), mono: true },
              { label: "Son hata", value: event.lastError },
            ]}
          />
        </SectionCard>
      </div>
    </>
  );
}
