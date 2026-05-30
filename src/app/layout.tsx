import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Providers } from "@/components/providers";
import "./globals.css";

const geistSans = Geist({
  subsets: ["latin"],
  variable: "--font-geist-sans",
});

const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
});

export const metadata: Metadata = {
  title: "UET GPT — Intelligent RAG Chatbot",
  description:
    "AI-powered chatbot for UET Taxila with RAG-based knowledge retrieval from official sources",
  keywords: ["UET", "UET Taxila", "chatbot", "RAG", "AI", "university"],
  openGraph: {
    title: "UET GPT — Intelligent RAG Chatbot",
    description: "AI-powered chatbot for UET Taxila",
    type: "website",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
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
