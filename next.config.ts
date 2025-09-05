/** @type {import('next').NextConfig} */
const nextConfig = {
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
