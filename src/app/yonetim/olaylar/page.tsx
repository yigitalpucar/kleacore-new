import type { Metadata } from "next";
import { domainEventState, getDomainEventStats, getDomainEvents } from "@/lib/dal/domain-events";
import { eventLabel, listEventDefinitions } from "@/lib/events/catalog";
import { eventSubscribers } from "@/lib/events/subscribers";
import { parsePagination } from "@/lib/utils/pagination";
import { OlaylarContent } from "./content";
import { requirePermission } from "@/lib/utils/auth-helpers";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Olaylar" };

function readParam(sp: Record<string, string | string[] | undefined>, key: string) {
  const value = sp[key];
  return typeof value === "string" ? value : "";
}

export default async function OlaylarPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requirePermission("activity.view");
  const sp = await searchParams;
  const { page } = parsePagination(sp);
  const filters = {
    type: readParam(sp, "type"),
    state: readParam(sp, "state"),
    aggregate: readParam(sp, "aggregate"),
    subscriber: readParam(sp, "subscriber"),
  };

  const [result, stats] = await Promise.all([getDomainEvents({ page, perPage: 50, ...filters }), getDomainEventStats()]);

  return (
    <OlaylarContent
      rows={result.rows.map((row) => ({
        id: row.id,
        type: row.type,
        label: eventLabel(row.type),
        aggregateType: row.aggregateType,
        aggregateId: row.aggregateId,
        occurredAt: row.occurredAt.toISOString(),
        processedAt: row.processedAt?.toISOString() ?? null,
        attempts: row.attempts,
        lastError: row.lastError,
        state: domainEventState(row),
        deliveries: row.deliveries.map((delivery) => ({ subscriber: delivery.subscriber, status: delivery.status })),
      }))}
      total={result.total}
      page={result.page}
      totalPages={result.totalPages}
      stats={stats}
      types={listEventDefinitions().map((definition) => ({ value: definition.type, label: definition.label }))}
      subscribers={eventSubscribers.map((subscriber) => ({ value: subscriber.name, label: subscriber.label }))}
      filters={filters}
    />
  );
}
