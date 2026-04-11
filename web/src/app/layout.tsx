import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Hobby Warehouse — Parts tracker",
    template: "%s · Hobby Warehouse",
  },
  description:
    "Register and track parts, components, and stock for your hobby warehouse.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      {/* Suppress mismatch when extensions inject attributes on <body> (e.g. data-atm-ext-installed). */}
      <body
        className="min-h-full flex flex-col bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-50"
        suppressHydrationWarning
      >
        {children}
      </body>
    </html>
  );
}
