import { prismaAdapter } from "@better-auth/prisma-adapter"
import { betterAuth } from "better-auth"
import type { PrismaClient } from "../generated/prisma/client"

type GoogleProviderConfig = {
  clientId: string
  clientSecret: string
}

function getTrustedOrigins(): string[] {
  return (process.env.BETTER_AUTH_TRUSTED_ORIGINS ?? "http://localhost:3000")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean)
}

function getGoogleProviderConfig(): GoogleProviderConfig | undefined {
  const clientId = process.env.GOOGLE_CLIENT_ID
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET

  if (!clientId && !clientSecret) {
    return undefined
  }

  if (!clientId || !clientSecret) {
    throw new Error(
      "GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET must be set together"
    )
  }

  return { clientId, clientSecret }
}

export function createAuth(prisma: PrismaClient) {
  const secret = process.env.BETTER_AUTH_SECRET

  if (!secret) {
    throw new Error("BETTER_AUTH_SECRET is required")
  }

  const google = getGoogleProviderConfig()

  return betterAuth({
    baseURL: process.env.BETTER_AUTH_URL ?? "http://localhost:3000",
    basePath: "/api/auth",
    secret,
    database: prismaAdapter(prisma, {
      provider: "postgresql",
    }),
    trustedOrigins: getTrustedOrigins(),
    emailAndPassword: {
      enabled: true,
    },
    ...(google ? { socialProviders: { google } } : {}),
  })
}

export { getGoogleProviderConfig }
