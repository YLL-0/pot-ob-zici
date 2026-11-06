import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  eslint: {
    ignoreDuringBuilds: false,
  },
  // Data read with node:fs at request time (lib/data.ts, lib/traseRepo.ts):
  // make sure serverless bundles (Vercel) ship it.
  outputFileTracingIncludes: {
    "/**": ["./data/poti/**/*", "./data/trase/**/*"],
  },
};

export default nextConfig;
