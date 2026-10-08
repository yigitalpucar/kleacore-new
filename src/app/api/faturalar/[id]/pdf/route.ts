import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getInvoiceById } from "@/lib/dal/invoices";
import { forbidden, notFound, unauthorized } from "@/lib/utils/api-response";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const currencyFormatter = new Intl.NumberFormat("tr-TR", {
  style: "currency",
  currency: "TRY",
  minimumFractionDigits: 2,
});

const paymentMethodLabel: Record<string, string> = {
  CREDIT_CARD: "Kredi Karti",
  BANK_TRANSFER: "Banka Havalesi",
  BALANCE: "Bakiye",
};

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

    const streamLines = ["BT", "/F1 10 Tf", "14 TL", "50 800 Td"];

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
    objects[pageId] =
      `<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 595 842] ` +
      `/Resources << /Font << /F1 ${fontId} 0 R >> >> /Contents ${contentId} 0 R >>`;
  }

  objects[catalogId] = `<< /Type /Catalog /Pages ${pagesId} 0 R >>`;
  objects[pagesId] =
    `<< /Type /Pages /Count ${pageIds.length} /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] >>`;
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

function formatDate(date: Date | null) {
  if (!date) return "-";
  return new Intl.DateTimeFormat("tr-TR").format(date);
}

function formatMoney(amount: number) {
  return currencyFormatter.format(amount);
}

function sanitizeFilePart(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  const user = session?.user;

  if (!user?.id) return unauthorized();

  const { id } = await params;
  const invoice = await getInvoiceById(id);
  if (!invoice) return notFound("Fatura bulunamadi");

  const isAdmin = user.role === "ADMIN";
  const isOwner = user.role === "CUSTOMER" && invoice.customerId === user.id;

  if (!isAdmin && !isOwner) return forbidden();

  const customerName = `${invoice.customer.name} ${invoice.customer.surname}`.trim();
  const customerLocation = [invoice.customer.city, invoice.customer.country]
    .filter(Boolean)
    .join(" / ");

  const lines: string[] = [
    "KLEACORE FATURA",
    "",
    `Fatura No: ${invoice.invoiceNumber}`,
    `Durum: ${invoice.status}`,
    `Olusturma Tarihi: ${formatDate(invoice.issuedAt)}`,
    `Son Odeme Tarihi: ${formatDate(invoice.dueDate)}`,
    `Odeme Tarihi: ${formatDate(invoice.paidAt)}`,
    "",
    "Musteri Bilgileri",
    `Ad Soyad: ${customerName || "-"}`,
    `E-posta: ${invoice.customer.email}`,
    ...(invoice.customer.phone ? [`Telefon: ${invoice.customer.phone}`] : []),
    ...(invoice.customer.companyName ? [`Sirket: ${invoice.customer.companyName}`] : []),
    ...(invoice.customer.taxOffice ? [`Vergi Dairesi: ${invoice.customer.taxOffice}`] : []),
    ...(invoice.customer.taxNumber ? [`Vergi No: ${invoice.customer.taxNumber}`] : []),
    ...(invoice.customer.address ? [`Adres: ${invoice.customer.address}`] : []),
    ...(customerLocation ? [`Sehir / Ulke: ${customerLocation}`] : []),
    "",
    "Kalemler",
    ...(invoice.items.length > 0
      ? invoice.items.map(
          (item, index) =>
            `${index + 1}. ${item.description} | ${item.quantity} x ${formatMoney(Number(item.unitPrice))}${
              Number(item.discountAmount) > 0 ? ` - indirim ${formatMoney(Number(item.discountAmount))}` : ""
            } = ${formatMoney(Number(item.totalPrice))} (KDV haric)`
        )
      : ["Kalem bulunamadi"]),
    "",
    "Toplamlar",
    `Ara Toplam: ${formatMoney(Number(invoice.subtotal))}`,
    `KDV Orani: %${Number(invoice.taxRate).toFixed(2)}`,
    `KDV Tutari: ${formatMoney(Number(invoice.taxAmount))}`,
    `Genel Toplam: ${formatMoney(Number(invoice.totalAmount))}`,
    `Odenen: ${formatMoney(Number(invoice.paidAmount))}`,
    `Kalan: ${formatMoney(Math.max(0, Number(invoice.totalAmount) - Number(invoice.paidAmount)))}`,
  ];

  if (invoice.notes) {
    lines.push("", "Notlar", invoice.notes);
  }

  if (invoice.payments.length > 0) {
    lines.push("", "Odeme Gecmisi");

    invoice.payments.forEach((payment, index) => {
      lines.push(
        `${index + 1}. ${formatMoney(Number(payment.amount))} | ${paymentMethodLabel[payment.method] ?? payment.method} | ${
          payment.status
        } | ${formatDate(payment.paidAt ?? payment.createdAt)}`
      );
    });
  }

  const sanitizedNumber = sanitizeFilePart(invoice.invoiceNumber || invoice.id) || invoice.id;
  const fileName = `fatura-${sanitizedNumber}.pdf`;
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
