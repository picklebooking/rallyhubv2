/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@workspace/ui"],
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
