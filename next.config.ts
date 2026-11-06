import type { NextConfig } from "next";

const managedLocalDev = process.env.NODE_ENV === "development" && Boolean(process.env.UPC_LOCAL_INTERNAL_SUPABASE_URL);
if (managedLocalDev) console.info(`[local dev] Next public Supabase: ${process.env.NEXT_PUBLIC_SUPABASE_URL}`);

const nextConfig: NextConfig = {
  cacheComponents: true,
  // Public env is compiled into client chunks. Do not reuse persisted dev output
  // across loopback/LAN starts or DHCP changes in the managed local launcher.
  ...(managedLocalDev ? { experimental: { turbopackFileSystemCacheForDev: false } } : {}),
  allowedDevOrigins: process.env.NODE_ENV === "development"
    ? ["localhost", "127.0.0.1", ...(process.env.UPC_LOCAL_LAN_HOST ? [process.env.UPC_LOCAL_LAN_HOST] : [])]
    : [],
};

export default nextConfig;
