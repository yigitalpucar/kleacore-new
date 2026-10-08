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
        disallow: [
          "/yonetim",
          "/musteri/panel",
          "/api",
          "/sepet",
          // carried over from the former public/robots.txt
          "/musteri/giris",
          "/musteri/sifremi-unuttum",
        ],
      },
    ],
    sitemap: `${baseUrl()}/sitemap.xml`,
  };
}
