import { db } from "@/lib/db";

export async function getServers() {
  return db.server.findMany({
    orderBy: { name: "asc" },
  });
}

export async function getServerById(id: string) {
  return db.server.findUnique({
    where: { id },
  });
}

export async function getServerServicesByCustomer(customerId: string) {
  return db.service.findMany({
    where: {
      customerId,
      product: {
        category: {
          slug: { in: ["vds", "vps", "server"] },
        },
      },
    },
    include: {
      product: {
        select: {
          id: true,
          name: true,
          sku: true,
          category: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });
}
