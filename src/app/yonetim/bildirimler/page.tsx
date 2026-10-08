import type { Metadata } from "next";
import { getNotificationLogStats, getNotificationLogs } from "@/lib/dal/notification-logs";
import { listTemplates } from "@/lib/notifications/templates";
import { parsePagination } from "@/lib/utils/pagination";
import { BildirimlerContent } from "./content";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Bildirimler" };

function readParam(sp: Record<string, string | string[] | undefined>, key: string) {
  const value = sp[key];
  return typeof value === "string" ? value : "";
}

export default async function BildirimlerPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const { page } = parsePagination(sp);
  const filters = {
    status: readParam(sp, "status"),
    channel: readParam(sp, "channel"),
    template: readParam(sp, "template"),
    search: readParam(sp, "search"),
  };

  const [result, stats] = await Promise.all([
    getNotificationLogs({ page, perPage: 50, ...filters }),
    getNotificationLogStats(),
  ]);

  const templates = listTemplates().map((template) => ({ key: template.key, label: template.label }));
  const labels = Object.fromEntries(templates.map((template) => [template.key, template.label]));

  return (
    <BildirimlerContent
      rows={result.rows.map((row) => ({
        id: row.id,
        template: row.template,
        templateLabel: labels[row.template] ?? row.template,
        channel: row.channel,
        to: row.to,
        subject: row.subject,
        status: row.status,
        error: row.error,
        attempts: row.attempts,
        redacted: row.redacted,
        isResend: Boolean(row.resendOfId),
        createdAt: row.createdAt.toISOString(),
        sentAt: row.sentAt?.toISOString() ?? null,
        customer: row.user
          ? { id: row.user.id, name: `${row.user.name} ${row.user.surname}`.trim() || row.user.email }
          : null,
      }))}
      total={result.total}
      page={result.page}
      totalPages={result.totalPages}
      stats={stats}
      templates={templates}
      filters={filters}
    />
  );
}
