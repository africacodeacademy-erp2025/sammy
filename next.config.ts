import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone", // Required for Docker production builds
  eslint: {
    // ✅ Ignore ESLint errors during builds (including Vercel)
    ignoreDuringBuilds: true,
  },
  typescript: {
    // ✅ Ignore TypeScript errors during builds
    ignoreBuildErrors: true,
  },
  serverExternalPackages: ["mongodb", "agenda"],
  webpack: (config, { isServer }) => {
    if (isServer) {
      // Don't bundle these packages on the server
      config.externals.push("mongodb", "agenda");
    }
    return config;
  },
};

export default nextConfig;
