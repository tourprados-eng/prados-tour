import type { NextConfig } from "next";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "";
const storageHostname = supabaseUrl ? new URL(supabaseUrl).hostname : "";

const previewOrigin = process.env.BASE44_PUBLIC_HOST_SUFFIX
  ? `https://3000-${process.env.BASE44_PUBLIC_HOST_SUFFIX}`
  : "";

const nextConfig: NextConfig = {
  allowedDevOrigins: previewOrigin ? [previewOrigin] : [],
  images: {
    remotePatterns: storageHostname
      ? [
          {
            protocol: "https",
            hostname: storageHostname,
            pathname: "/storage/v1/object/public/**",
          },
        ]
      : [],
  },
};

export default nextConfig;