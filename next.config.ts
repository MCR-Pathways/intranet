import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  experimental: {
    turbopackFileSystemCacheForDev: true,
  },
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
  async redirects() {
    return [
      {
        source: "/intranet/resources/:path*",
        destination: "/resources/:path*",
        permanent: true,
      },
      {
        source: "/intranet/resources",
        destination: "/resources",
        permanent: true,
      },
      {
        source: "/hr/org-chart",
        destination: "/resources/article/org-chart",
        permanent: true,
      },
    ];
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
          // CSP: Enforcing. unsafe-eval omitted in production (only needed for
          // React error stack debugging in dev). Remaining roadmap: replace
          // 'unsafe-inline' with nonce-based CSP via proxy.ts when the performance
          // trade-off (forced dynamic rendering) is acceptable.
          {
            key: "Content-Security-Policy",
            value:
              "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://use.typekit.net; img-src 'self' blob: data: https://*.supabase.co https://*.googleusercontent.com; connect-src 'self' https://*.supabase.co https://*.algolia.net https://*.algolianet.com; font-src 'self' https://use.typekit.net https://p.typekit.net; frame-src 'self' https://docs.google.com https://www.youtube.com https://player.vimeo.com; frame-ancestors 'none'",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
