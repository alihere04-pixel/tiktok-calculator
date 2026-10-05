import type { NextConfig } from "next";
import createMDX from "@next/mdx";

const withMDX = createMDX({
  extension: /\.mdx?$/,
  options: {
    remarkPlugins: [],
    rehypePlugins: [],
  },
});

const nextConfig: NextConfig = {
  generateBuildId: async () => {
    return process.env.VERCEL_GIT_COMMIT_SHA || process.env.GITHUB_SHA || "dev";
  },
  deploymentId: process.env.VERCEL_GIT_COMMIT_SHA || process.env.GITHUB_SHA || "dev",
  pageExtensions: ["ts", "tsx", "js", "jsx", "md", "mdx"],
};

export default withMDX(nextConfig);