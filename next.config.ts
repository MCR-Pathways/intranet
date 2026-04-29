import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  experimental: {
    turbopackFileSystemCacheForDev: true,
    serverActions: {
      // 4 MB matches IMAGE_MAX_SIZE_BYTES in src/lib/intranet.ts. Constrained
      // by Vercel Hobby's hard 4.5 MB function payload cap (which can't be
      // raised by this setting anyway). Bump to ~100 MB when upgrading to Pro.
      bodySizeLimit: "4mb",
    },
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.googleusercontent.com",
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
              "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://use.typekit.net https://p.typekit.net; img-src 'self' blob: data: https://*.googleusercontent.com; connect-src 'self' https://*.supabase.co https://*.algolia.net https://*.algolianet.com; font-src 'self' https://use.typekit.net https://p.typekit.net; frame-src 'self' https://docs.google.com https://drive.google.com https://www.youtube.com https://www.youtube-nocookie.com https://player.vimeo.com; frame-ancestors 'none'",
          },
        ],
      },
      // Per-route CSP override for /api/drive-file/*. The global wildcard
      // sets frame-ancestors 'none' which would block our own document
      // lightbox iframe loading the proxy URL. Relax to 'self' for this
      // route only — same-origin embedding allowed (our app), cross-origin
      // still blocked. X-Frame-Options: SAMEORIGIN is the legacy fallback
      // for pre-CSP-Level-2 browsers (modern browsers ignore it when
      // frame-ancestors is set per the W3C spec).
      //
      // Next.js applies last-matching-rule-wins for header keys, so this
      // entry overrides the global X-Frame-Options: DENY and CSP for any
      // request to /api/drive-file/<fileId>.
      {
        source: "/api/drive-file/:path*",
        headers: [
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          {
            key: "Content-Security-Policy",
            value: "frame-ancestors 'self'",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
