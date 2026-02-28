import type { PrismaClient } from "@prisma/client";

export async function seedDomainTlds(db: PrismaClient) {
  const tlds = [
    // Popüler
    { ext: ".com", category: "Popüler", registerPrice: 149, renewPrice: 199, transferPrice: 149, displayOrder: 1 },
    { ext: ".net", category: "Popüler", registerPrice: 179, renewPrice: 229, transferPrice: 179, displayOrder: 2 },
    { ext: ".org", category: "Popüler", registerPrice: 189, renewPrice: 239, transferPrice: 189, displayOrder: 3 },
    { ext: ".info", category: "Popüler", registerPrice: 99, renewPrice: 149, transferPrice: 99, displayOrder: 4 },
    { ext: ".biz", category: "Popüler", registerPrice: 129, renewPrice: 179, transferPrice: 129, displayOrder: 5 },
    // Türkiye
    { ext: ".com.tr", category: "Türkiye", registerPrice: 99, renewPrice: 149, transferPrice: 99, displayOrder: 6 },
    { ext: ".net.tr", category: "Türkiye", registerPrice: 99, renewPrice: 149, transferPrice: 99, displayOrder: 7 },
    { ext: ".org.tr", category: "Türkiye", registerPrice: 99, renewPrice: 149, transferPrice: 99, displayOrder: 8 },
    { ext: ".gen.tr", category: "Türkiye", registerPrice: 79, renewPrice: 99, transferPrice: 79, displayOrder: 9 },
    { ext: ".web.tr", category: "Türkiye", registerPrice: 79, renewPrice: 99, transferPrice: 79, displayOrder: 10 },
    { ext: ".tv.tr", category: "Türkiye", registerPrice: 79, renewPrice: 99, transferPrice: 79, displayOrder: 11 },
    { ext: ".name.tr", category: "Türkiye", registerPrice: 79, renewPrice: 99, transferPrice: 79, displayOrder: 12 },
    { ext: ".info.tr", category: "Türkiye", registerPrice: 79, renewPrice: 99, transferPrice: 79, displayOrder: 13 },
    { ext: ".bbs.tr", category: "Türkiye", registerPrice: 79, renewPrice: 99, transferPrice: 79, displayOrder: 14 },
    // Teknoloji
    { ext: ".io", category: "Teknoloji", registerPrice: 499, renewPrice: 599, transferPrice: 499, displayOrder: 15 },
    { ext: ".dev", category: "Teknoloji", registerPrice: 199, renewPrice: 249, transferPrice: 199, displayOrder: 16 },
    { ext: ".app", category: "Teknoloji", registerPrice: 199, renewPrice: 249, transferPrice: 199, displayOrder: 17 },
    { ext: ".tech", category: "Teknoloji", registerPrice: 299, renewPrice: 399, transferPrice: 299, displayOrder: 18 },
    { ext: ".ai", category: "Teknoloji", registerPrice: 899, renewPrice: 999, transferPrice: 899, displayOrder: 19 },
    // İş
    { ext: ".co", category: "İş", registerPrice: 299, renewPrice: 399, transferPrice: 299, displayOrder: 20 },
    { ext: ".company", category: "İş", registerPrice: 149, renewPrice: 199, transferPrice: 149, displayOrder: 21 },
    { ext: ".business", category: "İş", registerPrice: 149, renewPrice: 199, transferPrice: 149, displayOrder: 22 },
    { ext: ".agency", category: "İş", registerPrice: 249, renewPrice: 299, transferPrice: 249, displayOrder: 23 },
    // Diğer
    { ext: ".online", category: "Diğer", registerPrice: 49, renewPrice: 299, transferPrice: 49, displayOrder: 24 },
    { ext: ".site", category: "Diğer", registerPrice: 39, renewPrice: 299, transferPrice: 39, displayOrder: 25 },
    { ext: ".store", category: "Diğer", registerPrice: 69, renewPrice: 499, transferPrice: 69, displayOrder: 26 },
    { ext: ".blog", category: "Diğer", registerPrice: 299, renewPrice: 399, transferPrice: 299, displayOrder: 27 },
  ];

  for (const tld of tlds) {
    await db.domainTld.create({ data: tld });
  }
}
