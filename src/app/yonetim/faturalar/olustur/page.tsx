import type { Metadata } from "next";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/utils/auth-helpers";
import { CreateInvoiceContent } from "./content";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Fatura oluştur" };

export default async function CreateInvoicePage() {
  await requirePermission("invoices.edit");

  const customers = await db.user.findMany({
    where: {
      role: "CUSTOMER",
      status: { not: "CLOSED" },
    },
    select: {
      id: true,
      name: true,
      surname: true,
      email: true,
    },
    orderBy: [{ name: "asc" }, { surname: "asc" }],
    take: 500,
  });

  const serializedCustomers = customers.map((customer) => ({
    id: customer.id,
    name: `${customer.name} ${customer.surname}`.trim(),
    email: customer.email,
  }));

  return <CreateInvoiceContent customers={serializedCustomers} />;
}
