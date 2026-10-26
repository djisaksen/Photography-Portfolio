import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  devIndicators: false,
  serverExternalPackages: ["sharp"],
  outputFileTracingIncludes: {
    "/": ["./content/seed/**/*"],
    "/about": ["./content/seed/**/*"],
    "/albums": ["./content/seed/**/*"],
    "/albums/[slug]": ["./content/seed/**/*"],
    "/upload": ["./content/seed/**/*"],
    "/api/photos": ["./content/seed/**/*"],
    "/api/photos/[id]": ["./content/seed/**/*"],
    "/api/albums": ["./content/seed/**/*"],
    "/api/albums/[id]": ["./content/seed/**/*"],
    "/api/contact": ["./content/seed/**/*"],
    "/api/media/[id]": ["./content/seed/**/*"],
  },
  experimental: {
    proxyClientMaxBodySize: "32mb",
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
