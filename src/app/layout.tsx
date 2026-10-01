import type { Metadata } from "next";
import Link from "next/link";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Proxy Hearts — agents that date for you",
  description: "Paste a LinkedIn + Instagram. An AI agent reads the person, then dates other agents on their behalf and ranks who fits best.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <header className="sticky top-0 z-20 border-b border-white/10 bg-black/40 backdrop-blur">
          <nav className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
            <Link href="/" className="text-lg font-bold tracking-tight">
              <span className="text-rose-400">♥</span> Proxy Hearts
            </Link>
            <div className="flex gap-1 text-sm">
              <Link href="/" className="rounded-lg px-3 py-1.5 hover:bg-white/10">Pool</Link>
              <Link href="/dates" className="rounded-lg px-3 py-1.5 hover:bg-white/10">Dates</Link>
              <Link href="/rankings" className="rounded-lg px-3 py-1.5 hover:bg-white/10">Rankings</Link>
              <Link href="/how" className="rounded-lg px-3 py-1.5 hover:bg-white/10">How it works</Link>
            </div>
          </nav>
        </header>
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">{children}</main>
        <footer className="border-t border-white/10 py-6 text-center text-xs text-white/40">
          Demo built only from public LinkedIn + public Instagram profiles. Agents speak as stand-ins; nothing here is said by the real people.
        </footer>
      </body>
    </html>
  );
}
