import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getCustomerReport, getRevenueReport, getServiceReport } from "@/lib/dal/reports";
import { forbidden, unauthorized } from "@/lib/utils/api-response";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const reportPeriods = ["7days", "30days", "3months", "6months", "1year"] as const;
type ReportPeriod = (typeof reportPeriods)[number];
const reportFormats = ["csv", "pdf"] as const;
type ReportFormat = (typeof reportFormats)[number];

const monthNames = ["Oca", "Sub", "Mar", "Nis", "May", "Haz", "Tem", "Agu", "Eyl", "Eki", "Kas", "Ara"];

function parseReportPeriod(value: string | null): ReportPeriod {
  if (value && reportPeriods.includes(value as ReportPeriod)) {
    return value as ReportPeriod;
  }
  return "6months";
}

function periodLabel(period: ReportPeriod) {
  if (period === "7days") return "Son 7 Gun";
  if (period === "30days") return "Son 30 Gun";
  if (period === "3months") return "Son 3 Ay";
  if (period === "1year") return "Son 1 Yil";
  return "Son 6 Ay";
}

function parseReportFormat(value: string | null): ReportFormat {
  if (value && reportFormats.includes(value as ReportFormat)) {
    return value as ReportFormat;
  }
  return "csv";
}

function getRangeByPeriod(period: ReportPeriod, now: Date) {
  const to = new Date(now);
  const from = new Date(now);

  if (period === "7days") {
    from.setDate(from.getDate() - 6);
    from.setHours(0, 0, 0, 0);
    return { from, to };
  }

  if (period === "30days") {
    from.setDate(from.getDate() - 29);
    from.setHours(0, 0, 0, 0);
    return { from, to };
  }

  if (period === "3months") {
    return { from: new Date(now.getFullYear(), now.getMonth() - 2, 1), to };
  }

  if (period === "1year") {
    return { from: new Date(now.getFullYear(), now.getMonth() - 11, 1), to };
  }

  return { from: new Date(now.getFullYear(), now.getMonth() - 5, 1), to };
}

function dayKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate()
  ).padStart(2, "0")}`;
}

function monthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function buildRevenueTrendRows(
  paidInvoices: Array<{ paidAt: Date | null; paidAmount: number }>,
  period: ReportPeriod,
  now: Date
) {
  const rows: Array<[string, number]> = [];

  if (period === "7days" || period === "30days") {
    const dayCount = period === "7days" ? 7 : 30;
    const revenueByDay = new Map<string, number>();

    for (const invoice of paidInvoices) {
      if (!invoice.paidAt) continue;
      const key = dayKey(new Date(invoice.paidAt));
      revenueByDay.set(key, (revenueByDay.get(key) ?? 0) + Number(invoice.paidAmount));
    }

    for (let i = dayCount - 1; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      const key = dayKey(date);
      const label =
        dayCount <= 7
          ? `${String(date.getDate()).padStart(2, "0")} ${monthNames[date.getMonth()]}`
          : `${String(date.getDate()).padStart(2, "0")}/${String(date.getMonth() + 1).padStart(2, "0")}`;
      rows.push([label, Number((revenueByDay.get(key) ?? 0).toFixed(2))]);
    }

    return rows;
  }

  const monthCount = period === "3months" ? 3 : period === "1year" ? 12 : 6;
  const revenueByMonth = new Map<string, number>();

  for (const invoice of paidInvoices) {
    if (!invoice.paidAt) continue;
    const key = monthKey(new Date(invoice.paidAt));
    revenueByMonth.set(key, (revenueByMonth.get(key) ?? 0) + Number(invoice.paidAmount));
  }

  for (let i = monthCount - 1; i >= 0; i--) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = monthKey(date);
    const label =
      monthCount === 12
        ? `${monthNames[date.getMonth()]} ${String(date.getFullYear()).slice(-2)}`
        : monthNames[date.getMonth()];

    rows.push([label, Number((revenueByMonth.get(key) ?? 0).toFixed(2))]);
  }

  return rows;
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
    const period = parseReportPeriod(request.nextUrl.searchParams.get("period"));
    const format = parseReportFormat(request.nextUrl.searchParams.get("format"));
    const now = new Date();
    const dateRange = getRangeByPeriod(period, now);

    const [revenueData, customerData, serviceData] = await Promise.all([
      getRevenueReport(dateRange),
      getCustomerReport(dateRange),
      getServiceReport(dateRange),
    ]);

    const topProductIds = revenueData.topProducts.map((item) => item.productId);
    const topCustomerIds = customerData.topByRevenue.map((item) => item.customerId);

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

    const productNameById = new Map(products.map((product) => [product.id, product.name] as const));
    const customerNameById = new Map(
      customers.map((customer) => [
        customer.id,
        `${customer.name} ${customer.surname}`.trim() || customer.email,
      ] as const)
    );

    const totalRevenue = Number(revenueData.totalRevenue);
    const invoiceCount = Number(revenueData.invoiceCount);
    const avgInvoiceAmount = Number(revenueData.avgInvoiceAmount);
    const monthlyRecurring = Number(serviceData.monthlyRecurring);
    const inactiveCustomers = customerData.totalCustomers - customerData.activeCustomers;

    const rows: unknown[][] = [
      ["Yonetim Raporu"],
      ["Donem", periodLabel(period)],
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
      ...buildRevenueTrendRows(revenueData.paidInvoices, period, now).map(([label, value]) => [
        label,
        value.toFixed(2),
      ]),
      [],
      ["Musteri Ozeti"],
      ["Toplam Musteri", customerData.totalCustomers],
      ["Aktif Musteri", customerData.activeCustomers],
      ["Pasif Musteri", inactiveCustomers],
      [`${periodLabel(period)} Yeni Kayit`, customerData.newInPeriod],
      [],
      ["Musteri Tur Dagilimi"],
      ["Tur", "Adet"],
      ...customerData.customersByType.map((item) => [
        item.customerType === "INDIVIDUAL" ? "Bireysel" : "Kurumsal",
        item._count.id,
      ]),
      [],
      ["Hizmet Durumlari"],
      ["Durum", "Adet"],
      ...serviceData.servicesByStatus.map((item) => [item.status, item._count.id]),
      [],
      ["En Cok Gelir Getiren Musteriler"],
      ["Musteri", "Gelir (TRY)", "Fatura Adedi"],
      ...customerData.topByRevenue.map((item) => [
        customerNameById.get(item.customerId) ?? item.customerId,
        Number(item._sum.paidAmount ?? 0).toFixed(2),
        item._count.id,
      ]),
      [],
      ["En Cok Gelir Getiren Urunler"],
      ["Urun", "Gelir (TRY)", "Siparis Adedi"],
      ...revenueData.topProducts.map((item) => [
        productNameById.get(item.productId) ?? item.productId,
        Number(item._sum.totalAmount ?? 0).toFixed(2),
        item._count.id,
      ]),
    ];
    const fileDate = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(
      now.getDate()
    ).padStart(2, "0")}`;

    if (format === "pdf") {
      const lines: string[] = [
        "Yonetim Raporu",
        `Donem: ${periodLabel(period)}`,
        `Baslangic: ${dateRange.from.toISOString()}`,
        `Bitis: ${dateRange.to.toISOString()}`,
        `Olusturma Zamani: ${now.toISOString()}`,
        "",
        "Gelir Ozeti",
        `Toplam Gelir (TRY): ${totalRevenue.toFixed(2)}`,
        `Fatura Sayisi: ${invoiceCount}`,
        `Ortalama Fatura Tutari (TRY): ${avgInvoiceAmount.toFixed(2)}`,
        `Aylik Tekrarlayan Gelir (TRY): ${monthlyRecurring.toFixed(2)}`,
        "",
        "Gelir Trendi",
        ...buildRevenueTrendRows(revenueData.paidInvoices, period, now).map(
          ([label, value]) => `${label}: ${value.toFixed(2)} TRY`
        ),
        "",
        "Musteri Ozeti",
        `Toplam Musteri: ${customerData.totalCustomers}`,
        `Aktif Musteri: ${customerData.activeCustomers}`,
        `Pasif Musteri: ${inactiveCustomers}`,
        `${periodLabel(period)} Yeni Kayit: ${customerData.newInPeriod}`,
        "",
        "Musteri Tur Dagilimi",
        ...customerData.customersByType.map(
          (item) =>
            `${item.customerType === "INDIVIDUAL" ? "Bireysel" : "Kurumsal"}: ${item._count.id}`
        ),
        "",
        "Hizmet Durumlari",
        ...serviceData.servicesByStatus.map((item) => `${item.status}: ${item._count.id}`),
        "",
        "En Cok Gelir Getiren Musteriler",
        ...customerData.topByRevenue.map((item) => {
          const customer = customerNameById.get(item.customerId) ?? item.customerId;
          const amount = Number(item._sum.paidAmount ?? 0).toFixed(2);
          return `${customer}: ${amount} TRY (${item._count.id} fatura)`;
        }),
        "",
        "En Cok Gelir Getiren Urunler",
        ...revenueData.topProducts.map((item) => {
          const product = productNameById.get(item.productId) ?? item.productId;
          const amount = Number(item._sum.totalAmount ?? 0).toFixed(2);
          return `${product}: ${amount} TRY (${item._count.id} siparis)`;
        }),
      ];

      const fileName = `rapor-${period}-${fileDate}.pdf`;
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
    const fileName = `rapor-${period}-${fileDate}.csv`;

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
