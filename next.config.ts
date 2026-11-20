import type { NextConfig } from "next";
import { withPayload } from "@payloadcms/next/withPayload";

const nextConfig: NextConfig = {
  // Data read with node:fs at request time (lib/data.ts, lib/traseRepo.ts):
  // make sure serverless bundles (Vercel) ship it.
  outputFileTracingIncludes: {
    "/**": ["./data/poti/**/*", "./data/trase/**/*"],
  },
};

// withPayload only adjusts bundling (server externals, aliases); it does
// not connect to the database, so the no-.env build is unaffected.
export default withPayload(nextConfig);
