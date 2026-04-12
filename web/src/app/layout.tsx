import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ThemeProvider, themeFlashScript } from "@/components/providers/ThemeProvider";
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
    /*
     * suppressHydrationWarning is required because the inline flash-prevention
     * script mutates data-theme / class on <html> before React hydrates,
     * causing a harmless attribute mismatch warning otherwise.
     */
    <html
      lang="en"
      data-theme="midnight-zinc"
      className={`dark ${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        {/* Prevent theme flash: apply stored theme before first paint */}
        <script dangerouslySetInnerHTML={{ __html: themeFlashScript }} />
      </head>
      <body
        className="min-h-full flex flex-col bg-canvas text-fg"
        suppressHydrationWarning
      >
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
