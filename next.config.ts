import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.googleusercontent.com",
      },
      {
        protocol: "https",
        hostname: "*.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "X-Frame-Options",
            value: "DENY",
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "Permissions-Policy",
            value:
              "camera=(), microphone=(), geolocation=(), browsing-topics=()",
          },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          // CSP: Report-Only for initial rollout. Tightening roadmap:
          // 1. Monitor browser console for violation reports
          // 2. Replace 'unsafe-inline' with nonces (requires Next.js nonce support)
          // 3. Remove 'unsafe-eval' once Turbopack/webpack dev dependency is confirmed prod-safe
          // 4. Promote to enforcing Content-Security-Policy once stable
          {
            key: "Content-Security-Policy-Report-Only",
            value:
              "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline' https://use.typekit.net; img-src 'self' data: https://*.supabase.co https://*.googleusercontent.com; connect-src 'self' https://*.supabase.co; font-src 'self' https://use.typekit.net https://p.typekit.net; frame-ancestors 'none'",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
