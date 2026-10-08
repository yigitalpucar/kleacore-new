import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  getResellerCustomers,
  getResellerStats,
  isResellerUser,
} from "@/lib/reseller";
import { BayilikContent } from "./content";
import { toNumber } from "@/lib/money";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Bayilik" };

export default async function BayilikPage() {
  const session = await auth();
  const userId = session!.user.id;

  const isReseller = await isResellerUser(userId);
  if (!isReseller) {
    notFound();
  }

  const [stats, customers, reseller] = await Promise.all([
    getResellerStats(userId),
    getResellerCustomers(userId),
    db.user.findUnique({
      where: { id: userId },
      select: { resellerDiscountPercent: true },
    }),
  ]);

  const serializedCustomers = customers.map((customer) => {
    const email = customer.email;
    const [localPart, domain] = email.split("@");
    const maskedEmail = `${localPart[0]}***@${domain}`;

    return {
      id: customer.id,
      name: `${customer.name} ${customer.surname}`.trim(),
      email: maskedEmail,
      status: customer.status,
      registeredAt: customer.createdAt.toISOString(),
      activeServices: customer._count.services,
      orderCount: customer._count.orders,
    };
  });

  return (
    <BayilikContent
      discountPercent={toNumber(reseller?.resellerDiscountPercent)}
      customers={serializedCustomers}
      stats={{
        customerCount: stats.customerCount,
        activeServices: stats.activeServices,
        monthlyRevenue: stats.monthlyRevenue,
      }}
    />
  );
}