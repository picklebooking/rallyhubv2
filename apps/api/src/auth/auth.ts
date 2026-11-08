import { prismaAdapter } from '@better-auth/prisma-adapter';
import { betterAuth } from 'better-auth';
import {
  getAuthIpAddressHeader,
  getAuthRateLimitOptions,
} from '../config/rate-limit.config';
import type { PrismaClient } from '../generated/prisma/client';

type GoogleProviderConfig = {
  clientId: string;
  clientSecret: string;
};

function getTrustedOrigins(): string[] {
  return (process.env.BETTER_AUTH_TRUSTED_ORIGINS ?? 'http://localhost:3000')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
}

function getGoogleProviderConfig(): GoogleProviderConfig {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error('GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET are required');
  }

  return { clientId, clientSecret };
}

export function createAuth(prisma: PrismaClient) {
  const secret = process.env.BETTER_AUTH_SECRET;

  if (!secret) {
    throw new Error('BETTER_AUTH_SECRET is required');
  }

  const google = getGoogleProviderConfig();

  return betterAuth({
    baseURL: process.env.BETTER_AUTH_URL ?? 'http://localhost:3000',
    basePath: '/api/auth',
    secret,
    database: prismaAdapter(prisma, {
      provider: 'postgresql',
    }),
    trustedOrigins: getTrustedOrigins(),
    emailAndPassword: {
      enabled: true,
    },
    socialProviders: { google },
    rateLimit: getAuthRateLimitOptions(),
    advanced: {
      ipAddress: {
        // The sign-in limit is only as trustworthy as this header. Vercel
        // overwrites x-forwarded-for with the client address. Behind a proxy
        // that passes the client's header through (Next.js off Vercel) or with
        // no proxy, a client picks its own bucket; behind one that appends,
        // the header has two values and every client shares one bucket. Set
        // AUTH_IP_ADDRESS_HEADER to a header your proxy overwrites.
        ipAddressHeaders: [getAuthIpAddressHeader()],
      },
    },
  });
}

export { getGoogleProviderConfig };
