import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          // Prevent MIME-type sniffing
          { key: "X-Content-Type-Options", value: "nosniff" },
          // Block the app from being embedded in iframes (clickjacking)
          { key: "X-Frame-Options", value: "DENY" },
          // Don't leak full URLs (room codes are in the path) to other origins
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // The app uses none of these browser features
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
};

export default nextConfig;
