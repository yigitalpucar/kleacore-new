import type { Metadata } from "next";
import { auth } from "@/lib/auth";
import { getServicesByCustomer } from "@/lib/dal/services";
import { getInvoicesByCustomer } from "@/lib/dal/invoices";
import { IstatistiklerContent } from "./content";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "İstatistikler" };

const TZ = "Europe/Istanbul";
const monthKeyFmt = new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", timeZone: TZ });
const monthLabelFmt = new Intl.DateTimeFormat("tr-TR", { month: "short", timeZone: TZ });
const monthLongFmt = new Intl.DateTimeFormat("tr-TR", { month: "long", year: "numeric", timeZone: TZ });

const toNum = (v: unknown) => (v === null || v === undefined ? null : Number(v));
const round1 = (n: number) => Math.round(n * 10) / 10;

export default async function IstatistiklerPage() {
  const session = await auth();
  const userId = session!.user.id;
  const [services, invoices] = await Promise.all([getServicesByCustomer(userId), getInvoicesByCustomer(userId)]);

  // Per-service resource data (null = not reported for that service)
  const serviceUsage = services.map((s) => ({
    id: s.id,
    name: s.product.name,
    label: s.label,
    domain: s.domain,
    disk: { used: toNum(s.diskUsed), total: toNum(s.diskLimit) },
    bandwidth: { used: toNum(s.bandwidthUsed), total: toNum(s.bandwidthLimit) },
    cpu: toNum(s.cpuUsage),
    ram: toNum(s.ramUsage),
    status: s.status,
  }));

  const sumPair = (key: "disk" | "bandwidth") => {
    const rows = serviceUsage.filter((s) => s[key].used !== null && s[key].total !== null && s[key].total! > 0);
    return {
      used: round1(rows.reduce((a, s) => a + (s[key].used ?? 0), 0)),
      total: round1(rows.reduce((a, s) => a + (s[key].total ?? 0), 0)),
      count: rows.length,
    };
  };

  // Payments over the last 12 months, bucketed by payment month (Istanbul time)
  const now = new Date();
  const months: { key: string; label: string; longLabel: string; value: number }[] = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 15));
    months.push({
      key: monthKeyFmt.format(d),
      label: monthLabelFmt.format(d),
      longLabel: monthLongFmt.format(d),
      value: 0,
    });
  }
  let paidCount = 0;
  for (const inv of invoices) {
    if (inv.status !== "PAID" || !inv.paidAt) continue;
    const bucket = months.find((m) => m.key === monthKeyFmt.format(inv.paidAt!));
    if (!bucket) continue;
    bucket.value += Number(inv.paidAmount);
    paidCount += 1;
  }
  const paidTotal = months.reduce((a, m) => a + m.value, 0);

  return (
    <IstatistiklerContent
      serviceUsage={serviceUsage}
      totals={{
        services: services.length,
        activeServices: services.filter((s) => s.status === "ACTIVE").length,
        disk: sumPair("disk"),
        bandwidth: sumPair("bandwidth"),
        paidTotal: Math.round(paidTotal * 100) / 100,
        paidCount,
      }}
      monthlyPayments={months.map((m) => ({ label: m.label, longLabel: m.longLabel, value: Math.round(m.value * 100) / 100 }))}
    />
  );
}
