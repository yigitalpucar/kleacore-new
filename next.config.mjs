import { securityHeaders } from "./src/lib/security-headers.mjs";

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  reactStrictMode: true,
  poweredByHeader: false,
  experimental: {
    // forbidden() → 403 page for staff without the needed permission (3.6).
    authInterrupts: true,
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders({ dev: process.env.NODE_ENV !== "production" }),
      },
      // Ticket attachment downloads: user content, never rendered as a page
      // (the route sets the same; listed here so the site CSP above can't win).
      {
        source: "/api/support/attachments/:path*",
        headers: [
          { key: "Content-Security-Policy", value: "default-src 'none'; sandbox" },
          { key: "X-Content-Type-Options", value: "nosniff" },
        ],
      },
    ];
  },
  async redirects() {
    return [
      // Canonical host: www -> apex (keeps path and query).
      {
        source: "/:path*",
        has: [{ type: "host", value: "www.kleacore.com" }],
        destination: "https://kleacore.com/:path*",
        permanent: true,
      },
      {
        source: "/giris",
        destination: "/musteri/giris",
        permanent: true,
      },
      // Category index URLs duplicate their default sub-page.
      { source: "/hosting", destination: "/hosting/linux", permanent: true },
      { source: "/sunucu", destination: "/sunucu/vds", permanent: true },
      { source: "/ssl", destination: "/ssl/standart", permanent: true },
      { source: "/domain", destination: "/domain/kayit", permanent: true },
      { source: "/veri-merkezi", destination: "/veri-merkezi/barindirma", permanent: true },
    ];
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
      },
    ],
  },
};

export default nextConfig;
