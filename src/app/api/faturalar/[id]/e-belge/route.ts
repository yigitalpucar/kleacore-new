import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { hasPermission } from "@/lib/auth/permissions";
import { db } from "@/lib/db";
import { getEInvoicePdf } from "@/lib/integrations/efatura";
import { createLogger } from "@/lib/logger";
import { error, forbidden, notFound, unauthorized } from "@/lib/utils/api-response";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const log = createLogger("efatura.pdf");

/** Official e-Fatura / e-Arşiv PDF, fetched live from the entegratör. */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const user = session?.user;
  if (!user?.id) return unauthorized();

  const { id } = await params;
  const invoice = await db.invoice.findUnique({
    where: { id },
    select: { customerId: true, status: true },
  });
  if (!invoice) return notFound("Fatura bulunamadı");

  const isAdmin = hasPermission(user.role, "invoices.view");
  const isOwner = user.role === "CUSTOMER" && invoice.customerId === user.id;
  if (!isAdmin && !isOwner) return forbidden();

  try {
    const { pdf, filename } = await getEInvoicePdf(id);
    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename.replace(/[^\w.-]/g, "_")}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message === "EFATURA_PDF_NOT_AVAILABLE") {
      return notFound("Resmi fatura henüz hazır değil");
    }
    log.error("e-invoice pdf fetch failed", { invoiceId: id, error: message });
    return error("Resmi fatura şu an alınamadı, lütfen biraz sonra tekrar deneyin.", 502);
  }
}
