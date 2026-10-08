import type { DomainTld } from "@prisma/client";
import { db } from "@/lib/db";
import { toNumber } from "@/lib/money";

/** TLD row with plain-number prices, safe to pass to client components. */
export type DomainTldView = Omit<DomainTld, "registerPrice" | "renewPrice" | "transferPrice"> & {
  registerPrice: number;
  renewPrice: number;
  transferPrice: number;
};

function toView(tld: DomainTld): DomainTldView {
  return {
    ...tld,
    registerPrice: toNumber(tld.registerPrice),
    renewPrice: toNumber(tld.renewPrice),
    transferPrice: toNumber(tld.transferPrice),
  };
}

export async function getDomainTlds(): Promise<DomainTldView[]> {
  const tlds = await db.domainTld.findMany({
    where: { isActive: true },
    orderBy: { displayOrder: "asc" },
  });
  return tlds.map(toView);
}

export async function getDomainTldsByCategory(category: string): Promise<DomainTldView[]> {
  const tlds = await db.domainTld.findMany({
    where: { isActive: true, category },
    orderBy: { displayOrder: "asc" },
  });
  return tlds.map(toView);
}

export async function getDomainTldByExt(ext: string): Promise<DomainTldView | null> {
  const tld = await db.domainTld.findUnique({
    where: { ext },
  });
  return tld ? toView(tld) : null;
}
