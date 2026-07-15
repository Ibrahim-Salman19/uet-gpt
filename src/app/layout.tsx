import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Providers } from "@/components/providers";
import { APP_DESCRIPTION, APP_KEYWORDS, APP_NAME, APP_TAGLINE } from "@/lib/constants";
import { JsonLd } from "@/lib/json-ld";
import "./globals.css";

const geistSans = Geist({
  subsets: ["latin"],
  variable: "--font-geist-sans",
});

const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
});

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://uet-gpt.vercel.app";

const title = `${APP_NAME} — ${APP_TAGLINE}`;

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: title,
    template: `%s | ${APP_NAME}`,
  },
  description: APP_DESCRIPTION,
  keywords: APP_KEYWORDS,
  authors: [{ name: "UET GPT Team" }],
  creator: "UET GPT",
  publisher: "UET GPT",
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  openGraph: {
    title,
    description: APP_DESCRIPTION,
    url: siteUrl,
    siteName: APP_NAME,
    type: "website",
    locale: "en_PK",
  },
  twitter: {
    card: "summary_large_image",
    title,
    description: APP_DESCRIPTION,
  },
  alternates: {
    canonical: siteUrl,
  },
};

export const viewport: Viewport = {
  colorScheme: "dark",
  themeColor: "#070708",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <JsonLd />
      </head>
      <body className={`${geistSans.variable} ${geistMono.variable} font-sans antialiased`}>
        <a
          href="#main-content"
          className="fixed -left-full top-2 z-[var(--z-tooltip)] rounded-[var(--radius-sm)] bg-[var(--primary)] px-4 py-2 text-sm text-[var(--primary-fg)] shadow-[var(--shadow-lg)] transition-[left] focus:left-2"
        >
          Skip to main content
        </a>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
