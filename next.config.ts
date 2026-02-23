import type { NextConfig } from "next";

// Node.js v25 exposes a broken globalThis.localStorage stub that crashes @supabase/ssr.
// Delete it so the library falls back to in-memory storage during SSR.
if (typeof window === "undefined" && typeof globalThis.localStorage !== "undefined") {
  // @ts-expect-error — intentional cleanup of Node 25 stub
  delete globalThis.localStorage;
}

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: "50mb",
    },
  },
  serverExternalPackages: ["@xenova/transformers", "pdf-parse", "mammoth"],
};

export default nextConfig;
