import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { ThemeProvider } from "@/components/theme-provider";
import { AuthSessionProvider } from "@/components/auth/session-provider";
import { AnnouncementPopup } from "@/components/announcement-popup";
import { Toaster } from "@/components/ui/toaster";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || "https://kleacore.com"
  ),
  title: "KLEACORE - Domain, Hosting & Server Solutions",
  description:
    "Reliable hosting provider. Domain registration, web hosting, VDS and dedicated server services by KLEAWORK DIGITAL LLC.",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    locale: "tr_TR",
    siteName: "KLEACORE",
    title: "KLEACORE - Domain, Hosting & Server Solutions",
    description:
      "Domain registration, web hosting, VDS and dedicated server services by KLEAWORK DIGITAL LLC.",
    url: "/",
  },
  twitter: {
    card: "summary_large_image",
    title: "KLEACORE - Domain, Hosting & Server Solutions",
    description:
      "Domain registration, web hosting, VDS and dedicated server services by KLEAWORK DIGITAL LLC.",
  },
  keywords: [
    "hosting",
    "domain",
    "server",
    "vds",
    "web hosting",
    "ssl",
    "kleacore",
  ],
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
            {children}
            <Toaster />
            <AnnouncementPopup />
          </ThemeProvider>
        </AuthSessionProvider>
      </body>
    </html>
  );
}
