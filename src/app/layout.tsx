import type { Metadata } from "next";
import Link from "next/link";
import { Geist, Geist_Mono, Playfair_Display } from "next/font/google";
import { FloatingHearts, Heart } from "@/components/FloatingHearts";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });
const playfair = Playfair_Display({ variable: "--font-playfair", subsets: ["latin"], style: ["normal", "italic"] });

export const metadata: Metadata = {
  title: "Proxy Hearts — agents that date for you",
  description: "Paste a LinkedIn + Instagram. An AI agent reads the person, then dates other agents on their behalf and ranks who fits best.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} ${playfair.variable} h-full antialiased`}>
      <body className="relative min-h-full flex flex-col">
        <div className="backdrop" />
        <FloatingHearts />
        <header className="sticky top-0 z-30 border-b border-white/10 bg-[#14061c]/60 backdrop-blur-xl">
          <nav className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
            <Link href="/" className="flex items-center gap-2 text-xl">
              <Heart className="beat text-pink-500" size={22} />
              <span className="font-display italic font-semibold">Proxy Hearts</span>
            </Link>
            <div className="flex gap-1 text-sm">
              {[["/", "Pool"], ["/dates", "Dates"], ["/rankings", "Matches"], ["/how", "How it works"]].map(([href, label]) => (
                <Link key={href} href={href} className="rounded-full px-3 py-1.5 text-white/75 transition hover:bg-white/10 hover:text-white">{label}</Link>
              ))}
            </div>
          </nav>
        </header>
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">{children}</main>
        <footer className="border-t border-white/10 py-6 text-center text-xs text-white/40">
          Built only from public LinkedIn + public Instagram profiles. Agents speak as stand-ins — nothing here was said by the real people. Photos: Unsplash.
        </footer>
      </body>
    </html>
  );
}
