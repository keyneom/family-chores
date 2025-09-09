import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  reactStrictMode: true,
  output: 'export',
  basePath: '/family-chores',
  assetPrefix: '/family-chores/',
  images: {
    unoptimized: true,
  }
};

export default nextConfig;