import type { MetadataRoute } from "next";

function baseUrl() {
  return (process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || "https://kleacore.com").replace(
    /\/+$/,
    ""
  );
}

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/api/", "/musteri/panel/", "/yonetim/", "/sepet"],
      },
    ],
    sitemap: `${baseUrl()}/sitemap.xml`,
  };
}
