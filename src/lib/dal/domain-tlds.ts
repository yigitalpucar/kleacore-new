import { db } from "@/lib/db";

export async function getDomainTlds() {
  return db.domainTld.findMany({
    where: { isActive: true },
    orderBy: { displayOrder: "asc" },
  });
}

export async function getDomainTldsByCategory(category: string) {
  return db.domainTld.findMany({
    where: { isActive: true, category },
    orderBy: { displayOrder: "asc" },
  });
}

export async function getDomainTldByExt(ext: string) {
  return db.domainTld.findUnique({
    where: { ext },
  });
}
