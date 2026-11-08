import type { ThrottlerOptions } from '@nestjs/throttler';
import type { BetterAuthRateLimitOptions } from 'better-auth';

const DEFAULT_RATE_LIMIT_TTL_MS = 60_000;
const DEFAULT_RATE_LIMIT_MAX = 100;
const DEFAULT_RATE_LIMIT_BLOCK_DURATION_MS = 60_000;
const DEFAULT_AUTH_RATE_LIMIT_MAX = 5;
const DEFAULT_AUTH_RATE_LIMIT_WINDOW_SECONDS = 60;
const DEFAULT_TENANT_ADMIN_RATE_LIMIT_MAX = 5;
const DEFAULT_TENANT_ADMIN_RATE_LIMIT_TTL_MS = 60_000;
const DEFAULT_TRUST_PROXY_HOPS = 1;
const TENANT_ADMIN_THROTTLER_NAME = 'tenant-admin';

function getPositiveIntegerEnv(name: string, fallback: number): number {
  const rawValue = process.env[name];

  if (!rawValue) {
    return fallback;
  }

  const value = Number(rawValue);

  if (!Number.isInteger(value) || value <= 0) {
    return fallback;
  }

  return value;
}

function getRateLimitThrottlerOptions(): ThrottlerOptions {
  return {
    ttl: getPositiveIntegerEnv('RATE_LIMIT_TTL_MS', DEFAULT_RATE_LIMIT_TTL_MS),
    limit: getPositiveIntegerEnv('RATE_LIMIT_MAX', DEFAULT_RATE_LIMIT_MAX),
    blockDuration: getPositiveIntegerEnv(
      'RATE_LIMIT_BLOCK_DURATION_MS',
      DEFAULT_RATE_LIMIT_BLOCK_DURATION_MS,
    ),
  };
}

/**
 * Better Auth's own limiter guards `/api/auth/*`, which Nest's ThrottlerGuard
 * never sees. It is on in every environment (Better Auth defaults to
 * production only) and allows 5 sign-in and 5 sign-up attempts a minute per
 * client IP and path. Only these two paths are overridden, so Better Auth's
 * stricter defaults for password reset and change-password/email still apply.
 */
function getAuthRateLimitOptions(): BetterAuthRateLimitOptions {
  const rule = {
    window: getPositiveIntegerEnv(
      'AUTH_RATE_LIMIT_WINDOW_SECONDS',
      DEFAULT_AUTH_RATE_LIMIT_WINDOW_SECONDS,
    ),
    max: getPositiveIntegerEnv(
      'AUTH_RATE_LIMIT_MAX',
      DEFAULT_AUTH_RATE_LIMIT_MAX,
    ),
  };

  return {
    enabled: true,
    customRules: {
      '/sign-in/*': rule,
      '/sign-up/*': { ...rule },
    },
  };
}

/**
 * Per-user limit for tenant create, status and delete. Applied by
 * TenantAdminThrottlerGuard only, never by the global ThrottlerGuard.
 */
function getTenantAdminThrottlerOptions(): ThrottlerOptions {
  const ttl = getPositiveIntegerEnv(
    'TENANT_ADMIN_RATE_LIMIT_TTL_MS',
    DEFAULT_TENANT_ADMIN_RATE_LIMIT_TTL_MS,
  );

  return {
    name: TENANT_ADMIN_THROTTLER_NAME,
    limit: getPositiveIntegerEnv(
      'TENANT_ADMIN_RATE_LIMIT_MAX',
      DEFAULT_TENANT_ADMIN_RATE_LIMIT_MAX,
    ),
    ttl,
    blockDuration: ttl,
  };
}

/**
 * Number of proxy hops Express trusts when resolving `req.ip` from
 * x-forwarded-for. One hop matches Vercel, which overwrites the header with
 * the client address. Set TRUST_PROXY_HOPS=0 when the API is reachable
 * without such a proxy, or clients can spoof their address.
 */
function getTrustProxyHops(): number {
  const rawValue = process.env.TRUST_PROXY_HOPS;

  if (!rawValue || !/^\d+$/.test(rawValue)) {
    return DEFAULT_TRUST_PROXY_HOPS;
  }

  return Number(rawValue);
}

export {
  getAuthRateLimitOptions,
  getRateLimitThrottlerOptions,
  getTenantAdminThrottlerOptions,
  getTrustProxyHops,
};
