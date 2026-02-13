import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  async headers() {
    return [
      {
        source: "/agent-metadata-v2.json",
        headers: [
          { key: "CDN-Cache-Control", value: "no-cache" },
          { key: "Vercel-CDN-Cache-Control", value: "no-cache" },
        ],
      },
    ];
  },
};

export default nextConfig;
