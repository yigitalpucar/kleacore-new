import localFont from "next/font/local";

/**
 * Geist Mono as in geist/font/mono, but not preloaded: it only sets small
 * eyebrow/label text, so it must not compete with the page's first render
 * (LCP) for bandwidth on slow mobile connections. display: swap keeps the
 * fallback monospace until it arrives.
 */
export const GeistMono = localFont({
  src: "../../../node_modules/geist/dist/fonts/geist-mono/GeistMono-Variable.woff2",
  variable: "--font-geist-mono",
  adjustFontFallback: false,
  preload: false,
  display: "swap",
  fallback: [
    "ui-monospace",
    "SFMono-Regular",
    "Roboto Mono",
    "Menlo",
    "Monaco",
    "Liberation Mono",
    "DejaVu Sans Mono",
    "Courier New",
    "monospace",
  ],
  weight: "100 900",
});
