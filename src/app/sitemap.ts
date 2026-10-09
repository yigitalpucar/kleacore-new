import type { MetadataRoute } from "next";
import { getPublishedPosts } from "@/lib/dal/blog";
import { getCategories } from "@/lib/dal/knowledge-base";

export const dynamic = "force-dynamic";

type Entry = MetadataRoute.Sitemap[number];

/**
 * Public, indexable pages. Excluded on purpose: /api-docs, redirect-only
 * index routes (/hosting, /sunucu, /ssl, /domain, /veri-merkezi), /yonetim,
 * /musteri/*, /sepet, /odeme and per-product order pages.
 */
const staticRoutes: { path: string; changeFrequency: Entry["changeFrequency"]; priority: number }[] = [
  { path: "/", changeFrequency: "daily", priority: 1 },
  // Products
  { path: "/hosting/linux", changeFrequency: "weekly", priority: 0.9 },
  { path: "/hosting/wordpress", changeFrequency: "weekly", priority: 0.9 },
  { path: "/hosting/kurumsal", changeFrequency: "weekly", priority: 0.8 },
  { path: "/hosting/reseller", changeFrequency: "weekly", priority: 0.8 },
  { path: "/sunucu/vds", changeFrequency: "weekly", priority: 0.9 },
  { path: "/sunucu/vps", changeFrequency: "weekly", priority: 0.8 },
  { path: "/sunucu/bulut", changeFrequency: "weekly", priority: 0.8 },
  { path: "/sunucu/fiziksel", changeFrequency: "weekly", priority: 0.7 },
  { path: "/domain/kayit", changeFrequency: "weekly", priority: 0.9 },
  { path: "/domain/transfer", changeFrequency: "weekly", priority: 0.8 },
  { path: "/domain/belgesiz-tr", changeFrequency: "weekly", priority: 0.8 },
  { path: "/domain/whois", changeFrequency: "monthly", priority: 0.6 },
  { path: "/ssl/standart", changeFrequency: "weekly", priority: 0.8 },
  { path: "/ssl/wildcard", changeFrequency: "weekly", priority: 0.7 },
  { path: "/ssl/kurumsal", changeFrequency: "weekly", priority: 0.7 },
  { path: "/ssl/ev", changeFrequency: "weekly", priority: 0.7 },
  { path: "/veri-merkezi/barindirma", changeFrequency: "monthly", priority: 0.7 },
  { path: "/veri-merkezi/cdn", changeFrequency: "monthly", priority: 0.6 },
  { path: "/veri-merkezi/ddos-koruma", changeFrequency: "monthly", priority: 0.6 },
  { path: "/veri-merkezi/ip-asn", changeFrequency: "monthly", priority: 0.6 },
  // Content
  { path: "/blog", changeFrequency: "weekly", priority: 0.7 },
  { path: "/bilgi-bankasi", changeFrequency: "weekly", priority: 0.7 },
  // Corporate
  { path: "/hakkimizda", changeFrequency: "monthly", priority: 0.5 },
  { path: "/iletisim", changeFrequency: "monthly", priority: 0.5 },
  { path: "/kurumsal/kariyer", changeFrequency: "monthly", priority: 0.4 },
  { path: "/degisiklikler", changeFrequency: "weekly", priority: 0.4 },
  // Legal
  { path: "/yasal/kullanim-kosullari", changeFrequency: "yearly", priority: 0.3 },
  { path: "/yasal/gizlilik", changeFrequency: "yearly", priority: 0.3 },
  { path: "/yasal/kvkk", changeFrequency: "yearly", priority: 0.3 },
  { path: "/yasal/kvkk-basvuru", changeFrequency: "yearly", priority: 0.2 },
  { path: "/yasal/cerez", changeFrequency: "yearly", priority: 0.3 },
  { path: "/yasal/iade-kosullari", changeFrequency: "yearly", priority: 0.3 },
];

function baseUrl() {
  return (process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || "https://kleacore.com").replace(
    /\/+$/,
    ""
  );
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = baseUrl();
  const now = new Date();

  const entries: MetadataRoute.Sitemap = staticRoutes.map((route) => ({
    url: `${base}${route.path === "/" ? "" : route.path}` || base,
    lastModified: now,
    changeFrequency: route.changeFrequency,
    priority: route.priority,
  }));

  // DB-backed content; the static part is still served if the DB is unavailable.
  try {
    const [posts, kbCategories] = await Promise.all([
      getPublishedPosts({ page: 1, perPage: 1000, sortBy: "publishedAt", sortOrder: "desc" }),
      getCategories(),
    ]);

    for (const post of posts.data) {
      entries.push({
        url: `${base}/blog/${post.slug}`,
        lastModified: post.updatedAt,
        changeFrequency: "monthly",
        priority: 0.6,
      });
    }

    for (const category of kbCategories) {
      if (category.articles.length === 0) continue;
      entries.push({
        url: `${base}/bilgi-bankasi/${category.slug}`,
        lastModified: category.updatedAt,
        changeFrequency: "weekly",
        priority: 0.5,
      });
      for (const article of category.articles) {
        entries.push({
          url: `${base}/bilgi-bankasi/${category.slug}/${article.slug}`,
          lastModified: article.updatedAt,
          changeFrequency: "monthly",
          priority: 0.5,
        });
      }
    }
  } catch (error) {
    console.error("[sitemap] dynamic entries skipped:", error);
  }

  return entries;
}
