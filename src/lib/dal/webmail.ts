import { db } from "@/lib/db";

export async function getEmailAccountsByCustomer(customerId: string) {
  return db.emailAccount.findMany({
    where: { customerId },
    include: {
      domain: {
        select: {
          id: true,
          name: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function getEmailDomainsByCustomer(customerId: string) {
  const [domains, accountDomains] = await Promise.all([
    db.domain.findMany({
      where: {
        customerId,
        status: "ACTIVE",
      },
      select: {
        name: true,
      },
      orderBy: { name: "asc" },
    }),
    db.emailAccount.findMany({
      where: { customerId },
      select: { email: true },
    }),
  ]);

  const domainSet = new Set<string>(
    domains.map((domain) => domain.name.toLowerCase())
  );

  for (const account of accountDomains) {
    const domainPart = account.email.split("@")[1]?.toLowerCase();
    if (domainPart) {
      domainSet.add(domainPart);
    }
  }

  return [...domainSet]
    .sort((a, b) => a.localeCompare(b, "tr-TR"))
    .map((domain) => ({
      value: domain,
      label: domain,
    }));
}

export async function getEmailAccountStats(customerId: string) {
  const [totalAccounts, activeAccounts, aggregate] = await Promise.all([
    db.emailAccount.count({
      where: { customerId },
    }),
    db.emailAccount.count({
      where: { customerId, status: "ACTIVE" },
    }),
    db.emailAccount.aggregate({
      where: { customerId },
      _sum: {
        quotaMb: true,
        usedMb: true,
      },
    }),
  ]);

  return {
    totalAccounts,
    activeAccounts,
    totalStorage: aggregate._sum.quotaMb ?? 0,
    usedStorage: aggregate._sum.usedMb ?? 0,
  };
}
