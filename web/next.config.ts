import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* Large POST /api/admin/sync/import payloads: limits usually come from the host or reverse proxy,
   * not Next.js Route Handlers on Node. Adjust there if imports fail with size errors. */
};

export default nextConfig;
