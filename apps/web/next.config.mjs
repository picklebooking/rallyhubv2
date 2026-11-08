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
    // On Vercel, vercel.json routes /api/auth/* and /api/backend/* to the api
    // service before requests reach Next.js, and the API URL is only known at
    // runtime. This proxy is for local dev, `next start` and Docker Compose.
    if (process.env.VERCEL) return []

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
