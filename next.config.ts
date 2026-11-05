import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  allowedDevOrigins: process.env.NODE_ENV === "development"
    ? ["localhost", "127.0.0.1", ...(process.env.UPC_LOCAL_LAN_HOST ? [process.env.UPC_LOCAL_LAN_HOST] : [])]
    : [],
};

export default nextConfig;
