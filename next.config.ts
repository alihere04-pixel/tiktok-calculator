import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  basePath: '/tiktok',
  generateBuildId: async () => {
    return process.env.VERCEL_GIT_COMMIT_SHA || process.env.GITHUB_SHA || "dev";
  },
  deploymentId: process.env.VERCEL_GIT_COMMIT_SHA || process.env.GITHUB_SHA || "dev",
};

export default nextConfig;