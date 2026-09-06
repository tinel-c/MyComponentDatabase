import type { NextConfig } from "next";

const longCache = {
  key: "Cache-Control",
  value: "public, max-age=86400, stale-while-revalidate=604800",
} as const;

const nextConfig: NextConfig = {
  poweredByHeader: false,
  compress: true,
  experimental: {
    optimizePackageImports: ["lucide-react", "recharts"],
  },
  async headers() {
    // Next already immutable-caches /_next/static hashed assets.
    // Avoid :path* repeats adjacent to literals (path-to-regexp / Next 16).
    return [
      ...[
        "/icon-192.png",
        "/icon-512.png",
        "/icon-192-maskable.png",
        "/icon-512-maskable.png",
        "/favicon.ico",
        "/favicon-16.png",
        "/favicon-32.png",
        "/apple-touch-icon.png",
      ].map((source) => ({
        source,
        headers: [longCache],
      })),
      {
        source: "/manifest.webmanifest",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=3600, stale-while-revalidate=86400",
          },
          { key: "Content-Type", value: "application/manifest+json" },
        ],
      },
      {
        source: "/sw.js",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=0, must-revalidate",
          },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
    ];
  },
};

export default nextConfig;
