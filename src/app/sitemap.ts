import type { MetadataRoute } from "next";

const staticRoutes = [
  "/",
  "/api-docs",
  "/domain",
  "/domain/belgesiz-tr",
  "/domain/kayit",
  "/domain/transfer",
  "/domain/whois",
  "/hakkimizda",
  "/hosting",
  "/hosting/kurumsal",
  "/hosting/linux",
  "/hosting/reseller",
  "/hosting/wordpress",
  "/iletisim",
  "/kurumsal/kariyer",
  "/musteri/destek",
  "/musteri/durum",
  "/ssl",
  "/ssl/ev",
  "/ssl/kurumsal",
  "/ssl/standart",
  "/ssl/wildcard",
  "/sunucu",
  "/sunucu/bulut",
  "/sunucu/fiziksel",
  "/sunucu/vds",
  "/sunucu/vps",
  "/veri-merkezi",
  "/veri-merkezi/barindirma",
  "/veri-merkezi/cdn",
  "/veri-merkezi/ddos-koruma",
  "/veri-merkezi/ip-asn",
  "/yasal/cerez",
  "/yasal/gizlilik",
  "/yasal/iade-kosullari",
  "/yasal/kullanim-kosullari",
  "/yasal/kvkk",
];

function baseUrl() {
  return (process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || "https://kleacore.com").replace(
    /\/+$/,
    ""
  );
}

function entry(url: string, lastModified = new Date()): MetadataRoute.Sitemap[number] {
  return {
    url: `${baseUrl()}${url}`,
    lastModified,
    changeFrequency: url === "/" ? "daily" : "weekly",
    priority: url === "/" ? 1 : 0.7,
  };
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  return staticRoutes.map((route) => entry(route));
}
