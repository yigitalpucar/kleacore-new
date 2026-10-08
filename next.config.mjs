/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  reactStrictMode: true,
  poweredByHeader: false,
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
