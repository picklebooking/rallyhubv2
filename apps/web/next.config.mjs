/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@workspace/ui"],
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
    ],
  },
  async rewrites() {
    const apiOrigin = process.env.API_INTERNAL_URL ?? "http://localhost:3001"

    return [
      {
        source: "/api/auth/:path*",
        destination: `${apiOrigin}/api/auth/:path*`,
      },
      {
        source: "/api/backend/:path*",
        destination: `${apiOrigin}/:path*`,
      },
    ]
  },
}

export default nextConfig
