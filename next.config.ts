/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone", // Required for Docker production builds
  eslint: {
    // ✅ Ignore ESLint errors during builds (including Vercel)
    ignoreDuringBuilds: true,
  },
  typescript: {
    // ✅ Ignore TypeScript errors during builds
    ignoreBuildErrors: true,
  },
};

module.exports = nextConfig;
