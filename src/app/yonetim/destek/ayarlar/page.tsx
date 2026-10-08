import type { Metadata } from "next";
import { db } from "@/lib/db";
import { getAutoCloseDays } from "@/lib/support/settings";
import { SupportSettingsContent } from "./content";
import { requirePermission } from "@/lib/utils/auth-helpers";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Destek ayarları" };

export default async function SupportSettingsPage() {
  await requirePermission("settings.manage");
  const [autoCloseDays, mailboxes, inbound, lastRun] = await Promise.all([
    getAutoCloseDays(),
    db.supportMailbox.findMany({ orderBy: { createdAt: "asc" } }),
    db.inboundEmail.findMany({
      orderBy: { createdAt: "desc" },
      take: 50,
      select: {
        id: true,
        fromAddress: true,
        subject: true,
        status: true,
        reason: true,
        createdAt: true,
        ticket: { select: { id: true, ticketNumber: true } },
      },
    }),
    db.cronRun.findFirst({ where: { job: "support-mail" }, orderBy: { startedAt: "desc" }, select: { startedAt: true, status: true } }),
  ]);

  return (
    <SupportSettingsContent
      autoCloseDays={autoCloseDays}
      lastRun={lastRun ? { startedAt: lastRun.startedAt.toISOString(), status: lastRun.status } : null}
      mailboxes={mailboxes.map((m) => ({
        id: m.id,
        name: m.name,
        address: m.address,
        host: m.host,
        port: m.port,
        secure: m.secure,
        username: m.username,
        folder: m.folder,
        processedFolder: m.processedFolder ?? "",
        department: m.department ?? "",
        isActive: m.isActive,
        lastPolledAt: m.lastPolledAt?.toISOString() ?? null,
        lastError: m.lastError,
      }))}
      inbound={inbound.map((i) => ({ ...i, createdAt: i.createdAt.toISOString() }))}
    />
  );
}
