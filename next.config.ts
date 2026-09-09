import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  allowedDevOrigins: [
    "192.168.18.42",
  ],
};

export default nextConfig;
