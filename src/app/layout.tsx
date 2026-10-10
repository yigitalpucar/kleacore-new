import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { ThemeProvider } from "@/components/theme-provider";
import { AuthSessionProvider } from "@/components/auth/session-provider";
import { AnnouncementPopup } from "@/components/announcement-popup";
import { CookieConsent } from "@/components/cookie-consent";
import { Toaster } from "@/components/ui/toaster";
import { RouteProgress } from "@/components/app/route-progress";
import "./globals.css";

const defaultTitle = "KLEACORE | Alan Adı, Hosting ve Sunucu";
const defaultDescription =
  "KLEACORE; alan adı kaydı, cPanel ve LiteSpeed ile web hosting, NVMe SSD diskli VDS sunucu ve SSL sertifikası hizmetleri sunar. KLEAWORK DIGITAL LLC.";

/**
 * Site-wide SEO defaults. Pages override with their own `export const
 * metadata` (or `generateMetadata`) in page.tsx — set `title` (the
 * template adds " | KLEACORE"), `description` and `alternates.canonical`.
 * See docs/ui-kit.md › "Sayfa şablonu".
 */
export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || "https://kleacore.com"
  ),
  title: {
    default: defaultTitle,
    template: "%s | KLEACORE",
  },
  description: defaultDescription,
  applicationName: "KLEACORE",
  openGraph: {
    type: "website",
    locale: "tr_TR",
    siteName: "KLEACORE",
    title: defaultTitle,
    description: defaultDescription,
  },
  twitter: {
    card: "summary_large_image",
    title: defaultTitle,
    description: defaultDescription,
  },
  icons: {
    icon: "/favicon.png",
    shortcut: "/favicon.png",
    apple: "/favicon.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="tr" suppressHydrationWarning>
      <body
        className={`${GeistSans.variable} ${GeistMono.variable} font-sans antialiased`}
      >
        <AuthSessionProvider>
          <ThemeProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
            disableTransitionOnChange
          >
            <RouteProgress />
            {children}
            <Toaster />
            <AnnouncementPopup />
            <CookieConsent />
          </ThemeProvider>
        </AuthSessionProvider>
      </body>
    </html>
  );
}
