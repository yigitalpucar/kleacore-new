import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  getAccountingLedger,
  getAccountingReport,
  getCustomerReport,
  getRevenueReport,
  getServiceReport,
} from "@/lib/dal/reports";
import type { PaymentMethod, Prisma } from "@prisma/client";
import { add, toNumber, type MoneyInput } from "@/lib/money";
import { forbidden, unauthorized } from "@/lib/utils/api-response";
import { parseReportRange } from "@/lib/reports/range";
import { buildRevenueTrend, rangeLabel } from "@/lib/reports/revenue-trend";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const reportFormats = ["csv", "pdf"] as const;
type ReportFormat = (typeof reportFormats)[number];
const reportTypes = ["full", "accounting"] as const;
type ReportType = (typeof reportTypes)[number];

const paymentMethodLabels: Record<PaymentMethod, string> = {
  CREDIT_CARD: "Kredi Karti",
  BANK_TRANSFER: "Banka Havalesi",
  BALANCE: "Bakiye",
};

/** The PDF uses a Type1 font without Turkish glyphs; labels stay ASCII. */
function asciiText(text: string) {
  return text
    .replace(/ı/g, "i")
    .replace(/İ/g, "I")
    .replace(/–/g, "-")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "");
}

function parseReportFormat(value: string | null): ReportFormat {
  if (value && reportFormats.includes(value as ReportFormat)) {
    return value as ReportFormat;
  }
  return "csv";
}

function parseReportType(value: string | null): ReportType {
  if (value === "accounting") {
    return "accounting";
  }
  return "full";
}

function buildAccountingRows(
  accountingData: Awaited<ReturnType<typeof getAccountingReport>>,
  ledger: Awaited<ReturnType<typeof getAccountingLedger>>
) {
  const { summary, taxBreakdown } = accountingData;

  return [
    ["Muhasebe Ozeti"],
    ["Brut Gelir (TRY)", summary.grossRevenue.toFixed(2)],
    ["KDV Toplami (TRY)", summary.totalTax.toFixed(2)],
    ["Net Gelir (TRY)", summary.netRevenue.toFixed(2)],
    ["Tahsil Edilecek (TRY)", summary.outstanding.toFixed(2)],
    ["Bekleyen Fatura", summary.pendingCount],
    ["Gecikmis Fatura", summary.overdueCount],
    ["Iptal/Iade Adedi", summary.refunds.count],
    ["Iptal/Iade Tutari (TRY)", summary.refunds.sum.toFixed(2)],
    [],
    ["Odeme Yontemi Dagilimi"],
    ["Yontem", "Tutar (TRY)"],
    ...(
      Object.entries(summary.collectedByMethod) as Array<[PaymentMethod, number]>
    ).map(([method, amount]) => [paymentMethodLabels[method], amount.toFixed(2)]),
    [],
    ["Aylik KDV Dagilimi"],
    ["Ay", "Net (TRY)", "KDV (TRY)", "Toplam (TRY)"],
    ...taxBreakdown.map((row) => [
      row.label,
      row.subtotal.toFixed(2),
      row.tax.toFixed(2),
      row.total.toFixed(2),
    ]),
    [],
    ["Defter Kayitlari"],
    [
      "Tarih",
      "Fatura No",
      "Musteri",
      "Net (TRY)",
      "KDV (TRY)",
      "Toplam (TRY)",
      "Odeme Yontemi",
    ],
    ...ledger.map((entry) => [
      entry.date.toISOString(),
      entry.invoiceNumber,
      entry.customerName,
      entry.subtotal.toFixed(2),
      entry.taxAmount.toFixed(2),
      entry.totalAmount.toFixed(2),
      entry.paymentMethod ? paymentMethodLabels[entry.paymentMethod] : "-",
    ]),
  ];
}

function escapeCsvCell(value: unknown) {
  const str = value == null ? "" : String(value);
  if (/[;"\n\r]/.test(str)) {
    return `"${str.replace(/"/g, "\"\"")}"`;
  }
  return str;
}

function toCsv(rows: unknown[][]) {
  return rows
    .map((row) => row.map((cell) => escapeCsvCell(cell)).join(";"))
    .join("\r\n");
}

function escapePdfText(text: string) {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");
}

function buildSimplePdf(lines: string[]) {
  const linesPerPage = 48;
  const chunks: string[][] = [];

  for (let i = 0; i < lines.length; i += linesPerPage) {
    chunks.push(lines.slice(i, i + linesPerPage));
  }

  const objects: string[] = [];
  const catalogId = 1;
  const pagesId = 2;
  const fontId = 3;
  let nextId = 4;
  const pageIds: number[] = [];

  for (const chunk of chunks) {
    const contentId = nextId++;
    const pageId = nextId++;
    pageIds.push(pageId);

    const streamLines = [
      "BT",
      "/F1 10 Tf",
      "14 TL",
      "50 800 Td",
    ];

    chunk.forEach((line, index) => {
      if (index === 0) {
        streamLines.push(`(${escapePdfText(line)}) Tj`);
      } else {
        streamLines.push("T*");
        streamLines.push(`(${escapePdfText(line)}) Tj`);
      }
    });

    streamLines.push("ET");
    const stream = `${streamLines.join("\n")}\n`;

    objects[contentId] = `<< /Length ${Buffer.byteLength(stream, "utf8")} >>\nstream\n${stream}endstream`;
    objects[pageId] = `<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 ${fontId} 0 R >> >> /Contents ${contentId} 0 R >>`;
  }

  objects[catalogId] = `<< /Type /Catalog /Pages ${pagesId} 0 R >>`;
  objects[pagesId] = `<< /Type /Pages /Count ${pageIds.length} /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] >>`;
  objects[fontId] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>";

  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [0];

  for (let i = 1; i < objects.length; i++) {
    if (!objects[i]) continue;
    offsets[i] = Buffer.byteLength(pdf, "utf8");
    pdf += `${i} 0 obj\n${objects[i]}\nendobj\n`;
  }

  const xrefOffset = Buffer.byteLength(pdf, "utf8");
  pdf += `xref\n0 ${objects.length}\n`;
  pdf += "0000000000 65535 f \n";

  for (let i = 1; i < objects.length; i++) {
    const offset = offsets[i] ?? 0;
    pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
  }

  pdf += `trailer\n<< /Size ${objects.length} /Root ${catalogId} 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  return Buffer.from(pdf, "utf8");
}

export async function GET(request: NextRequest) {
  const session = await auth();
  const userRole = (session?.user as { role?: string } | undefined)?.role;

  if (!session?.user) return unauthorized();
  if (userRole !== "ADMIN") return forbidden();

  try {
    const range = parseReportRange(request.nextUrl.searchParams);
    const period = range.period === "custom" ? `${range.fromDay}_${range.toDay}` : range.period;
    const format = parseReportFormat(request.nextUrl.searchParams.get("format"));
    const reportType = parseReportType(request.nextUrl.searchParams.get("type"));
    const now = new Date();
    const dateRange = { from: range.from, to: range.to };

    const [revenueData, customerData, serviceData, accountingData, accountingLedger] =
      await Promise.all([
        reportType === "accounting"
          ? Promise.resolve(null)
          : getRevenueReport(dateRange),
        reportType === "accounting"
          ? Promise.resolve(null)
          : getCustomerReport(dateRange),
        reportType === "accounting"
          ? Promise.resolve(null)
          : getServiceReport(dateRange),
        getAccountingReport(dateRange),
        getAccountingLedger(dateRange, 100, "asc"),
      ]);

    const accountingRows = buildAccountingRows(accountingData, accountingLedger);

    let rows: unknown[][];

    if (reportType === "accounting") {
      rows = [
        ["Muhasebe Raporu"],
        ["Donem", asciiText(rangeLabel(range))],
        ["Baslangic", dateRange.from.toISOString()],
        ["Bitis", dateRange.to.toISOString()],
        ["Olusturma Zamani", now.toISOString()],
        [],
        ...accountingRows,
      ];
    } else {
      const topProductIds = revenueData!.topProducts.map((item) => item.productId);
      const topCustomerIds = customerData!.topByRevenue.map((item) => item.customerId);

      const [products, customers] = await Promise.all([
        topProductIds.length > 0
          ? db.product.findMany({
              where: { id: { in: topProductIds } },
              select: { id: true, name: true },
            })
          : Promise.resolve([]),
        topCustomerIds.length > 0
          ? db.user.findMany({
              where: { id: { in: topCustomerIds } },
              select: { id: true, name: true, surname: true, email: true },
            })
          : Promise.resolve([]),
      ]);

      const productNameById = new Map(
        products.map((product) => [product.id, product.name] as const)
      );
      const customerNameById = new Map(
        customers.map((customer) => [
          customer.id,
          `${customer.name} ${customer.surname}`.trim() || customer.email,
        ] as const)
      );

      const totalRevenue = Number(revenueData!.totalRevenue);
      const invoiceCount = Number(revenueData!.invoiceCount);
      const avgInvoiceAmount = Number(revenueData!.avgInvoiceAmount);
      const monthlyRecurring = Number(serviceData!.monthlyRecurring);
      const inactiveCustomers = customerData!.totalCustomers - customerData!.activeCustomers;

      rows = [
        ["Yonetim Raporu"],
        ["Donem", asciiText(rangeLabel(range))],
        ["Baslangic", dateRange.from.toISOString()],
        ["Bitis", dateRange.to.toISOString()],
        ["Olusturma Zamani", now.toISOString()],
        [],
        ["Gelir Ozeti"],
        ["Toplam Gelir (TRY)", totalRevenue.toFixed(2)],
        ["Fatura Sayisi", invoiceCount],
        ["Ortalama Fatura Tutari (TRY)", avgInvoiceAmount.toFixed(2)],
        ["Aylik Tekrarlayan Gelir (TRY)", monthlyRecurring.toFixed(2)],
        [],
        ["Gelir Trendi"],
        ["Periyot", "Gelir (TRY)"],
        ...buildRevenueTrend(revenueData!.paidInvoices, range).points.map((p): [string, number] => [p.label, p.value]).map(([label, value]) => [
          label,
          value.toFixed(2),
        ]),
        [],
        ["Musteri Ozeti"],
        ["Toplam Musteri", customerData!.totalCustomers],
        ["Aktif Musteri", customerData!.activeCustomers],
        ["Pasif Musteri", inactiveCustomers],
        [`${asciiText(rangeLabel(range))} Yeni Kayit`, customerData!.newInPeriod],
        [],
        ["Musteri Tur Dagilimi"],
        ["Tur", "Adet"],
        ...customerData!.customersByType.map((item) => [
          item.customerType === "INDIVIDUAL" ? "Bireysel" : "Kurumsal",
          item._count.id,
        ]),
        [],
        ["Hizmet Durumlari"],
        ["Durum", "Adet"],
        ...serviceData!.servicesByStatus.map((item) => [item.status, item._count.id]),
        [],
        ["En Cok Gelir Getiren Musteriler"],
        ["Musteri", "Gelir (TRY)", "Fatura Adedi"],
        ...customerData!.topByRevenue.map((item) => [
          customerNameById.get(item.customerId) ?? item.customerId,
          Number(item._sum.paidAmount ?? 0).toFixed(2),
          item._count.id,
        ]),
        [],
        ["En Cok Gelir Getiren Urunler"],
        ["Urun", "Gelir (TRY)", "Siparis Adedi"],
        ...revenueData!.topProducts.map((item) => [
          productNameById.get(item.productId) ?? item.productId,
          Number(item._sum.totalAmount ?? 0).toFixed(2),
          item._count.id,
        ]),
        [],
        ...accountingRows,
      ];
    }
    const fileDate = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(
      now.getDate()
    ).padStart(2, "0")}`;

    if (format === "pdf") {
      const lines: string[] =
        reportType === "accounting"
          ? [
              "Muhasebe Raporu",
              `Donem: ${asciiText(rangeLabel(range))}`,
              `Baslangic: ${dateRange.from.toISOString()}`,
              `Bitis: ${dateRange.to.toISOString()}`,
              `Olusturma Zamani: ${now.toISOString()}`,
              "",
              ...accountingRows.map((row) => row.map((cell) => String(cell ?? "")).join(" | ")),
            ]
          : [
              "Yonetim Raporu",
              `Donem: ${asciiText(rangeLabel(range))}`,
              `Baslangic: ${dateRange.from.toISOString()}`,
              `Bitis: ${dateRange.to.toISOString()}`,
              `Olusturma Zamani: ${now.toISOString()}`,
              "",
              "Gelir Ozeti",
              `Toplam Gelir (TRY): ${Number(revenueData!.totalRevenue).toFixed(2)}`,
              `Fatura Sayisi: ${revenueData!.invoiceCount}`,
              `Ortalama Fatura Tutari (TRY): ${Number(revenueData!.avgInvoiceAmount).toFixed(2)}`,
              `Aylik Tekrarlayan Gelir (TRY): ${Number(serviceData!.monthlyRecurring).toFixed(2)}`,
              "",
              "Gelir Trendi",
              ...buildRevenueTrend(revenueData!.paidInvoices, range).points.map((p): [string, number] => [p.label, p.value]).map(
                ([label, value]) => `${label}: ${value.toFixed(2)} TRY`
              ),
              "",
              "Musteri Ozeti",
              `Toplam Musteri: ${customerData!.totalCustomers}`,
              `Aktif Musteri: ${customerData!.activeCustomers}`,
              `Pasif Musteri: ${customerData!.totalCustomers - customerData!.activeCustomers}`,
              `${asciiText(rangeLabel(range))} Yeni Kayit: ${customerData!.newInPeriod}`,
              "",
              "Musteri Tur Dagilimi",
              ...customerData!.customersByType.map(
                (item) =>
                  `${item.customerType === "INDIVIDUAL" ? "Bireysel" : "Kurumsal"}: ${item._count.id}`
              ),
              "",
              "Hizmet Durumlari",
              ...serviceData!.servicesByStatus.map((item) => `${item.status}: ${item._count.id}`),
              "",
              "En Cok Gelir Getiren Musteriler",
              ...customerData!.topByRevenue.map((item) => {
                const amount = Number(item._sum.paidAmount ?? 0).toFixed(2);
                return `${item.customerId}: ${amount} TRY (${item._count.id} fatura)`;
              }),
              "",
              "En Cok Gelir Getiren Urunler",
              ...revenueData!.topProducts.map((item) => {
                const amount = Number(item._sum.totalAmount ?? 0).toFixed(2);
                return `${item.productId}: ${amount} TRY (${item._count.id} siparis)`;
              }),
              "",
              ...accountingRows.map((row) => row.map((cell) => String(cell ?? "")).join(" | ")),
            ];

      const fileName =
        reportType === "accounting"
          ? `muhasebe-raporu-${period}-${fileDate}.pdf`
          : `rapor-${period}-${fileDate}.pdf`;
      const pdfBytes = buildSimplePdf(lines);

      return new NextResponse(pdfBytes, {
        status: 200,
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="${fileName}"`,
          "Cache-Control": "no-store",
        },
      });
    }

    const csv = `\uFEFF${toCsv(rows)}`;
    const fileName =
      reportType === "accounting"
        ? `muhasebe-raporu-${period}-${fileDate}.csv`
        : `rapor-${period}-${fileDate}.csv`;

    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${fileName}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch {
    return NextResponse.json(
      { success: false, error: "Rapor olusturulurken bir hata olustu" },
      { status: 500 }
    );
  }
}
