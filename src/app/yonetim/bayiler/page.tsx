import type { Metadata } from "next";
import { getAdminResellers } from "@/lib/actions/admin/resellers";
import { db } from "@/lib/db";
import { BayilerContent } from "./content";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Bayiler" };

export default async function BayilerPage() {
  const [resellers, customers] = await Promise.all([
    getAdminResellers(),
    db.user.findMany({
      where: { role: "CUSTOMER" },
      select: {
        id: true,
        email: true,
        name: true,
        surname: true,
        isReseller: true,
        parentResellerId: true,
      },
      orderBy: { createdAt: "desc" },
      take: 200,
    }),
  ]);

  const serializedResellers = resellers.map((reseller) => ({
    id: reseller.id,
    name: `${reseller.name} ${reseller.surname}`.trim(),
    email: reseller.email,
    status: reseller.status,
    discountPercent: reseller.resellerDiscountPercent,
    customerCount: reseller._count.resellerCustomers,
    createdAt: reseller.createdAt.toISOString(),
  }));

  const serializedCustomers = customers.map((customer) => ({
    id: customer.id,
    email: customer.email,
    name: `${customer.name} ${customer.surname}`.trim(),
    isReseller: customer.isReseller,
    parentResellerId: customer.parentResellerId,
  }));

  return (
    <BayilerContent
      resellers={serializedResellers}
      customers={serializedCustomers}
    />
  );
}