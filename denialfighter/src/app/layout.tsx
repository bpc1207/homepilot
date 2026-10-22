import "./globals.css";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "DenialFighter",
  description: "Appeal a denied health insurance claim with a ready-to-send letter, checklist and deadline reminders.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-50 text-slate-900 antialiased">
        <header className="border-b bg-white">
          <nav className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3">
            <Link href="/" className="font-semibold">DenialFighter</Link>
            <Link href="/dashboard" className="text-sm text-slate-600 hover:underline">My cases</Link>
          </nav>
        </header>
        <main className="mx-auto max-w-4xl px-4 py-8">{children}</main>
        <footer className="mx-auto max-w-4xl px-4 pb-10 text-xs text-slate-500">
          DenialFighter is not a law firm, insurer or medical provider and does not give legal or medical advice.
          You review, edit and file your own appeal; we never submit anything on your behalf. Outcomes are not guaranteed.
        </footer>
      </body>
    </html>
  );
}
