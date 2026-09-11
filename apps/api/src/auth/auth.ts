import { prismaAdapter } from "@better-auth/prisma-adapter"
import { betterAuth } from "better-auth"
import type { PrismaClient } from "../generated/prisma/client"

function getTrustedOrigins(): string[] {
  return (process.env.BETTER_AUTH_TRUSTED_ORIGINS ?? "http://localhost:3000")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean)
}

export function createAuth(prisma: PrismaClient) {
  const secret = process.env.BETTER_AUTH_SECRET

  if (!secret) {
    throw new Error("BETTER_AUTH_SECRET is required")
  }

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
  })
}
