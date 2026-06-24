import type { NextConfig } from "next";
import { privateSeoPaths } from "./lib/seo";

const privateSeoHeaders = privateSeoPaths.flatMap((path) => [
  {
    source: path,
    headers: [
      {
        key: 'X-Robots-Tag',
        value: 'noindex, nofollow',
      },
    ],
  },
  {
    source: `${path}/:path*`,
    headers: [
      {
        key: 'X-Robots-Tag',
        value: 'noindex, nofollow',
      },
    ],
  },
]);

const nextConfig: NextConfig = {
  reactCompiler: true,
  async headers() {
    return [
      ...privateSeoHeaders,
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=(), payment=()',
          },
        ],
      },
    ];
  },
  images: {
    remotePatterns: [
      {
        protocol: 'http',
        hostname: 'localhost',
        port: '3000',
        pathname: '/uploads/**',
      },
      {
        protocol: 'http',
        hostname: '127.0.0.1',
        port: '3000',
        pathname: '/uploads/**',
      },
      {
        protocol: 'https',
        hostname: 'res.cloudinary.com',
        pathname: '/**',
      },
    ],
    dangerouslyAllowSVG: false,
  },
};

export default nextConfig;
