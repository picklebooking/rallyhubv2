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
const DEFAULT_AUTH_IP_ADDRESS_HEADER = 'x-forwarded-for';
const HEADER_NAME_PATTERN = /^[!#$%&'*+\-.^_`|~0-9a-z]+$/;
const SPECIAL_RULE_WINDOW_SECONDS = 60;
/** Paths Better Auth limits with its own stricter default rules. */
const BETTER_AUTH_SPECIAL_RULE_PATHS = [
  '/change-password',
  '/change-email',
  '/forget-password',
  '/forget-password/*',
  '/request-password-reset',
  '/send-verification-email',
  '/email-otp/send-verification-otp',
  '/email-otp/request-password-reset',
];

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
 *
 * AUTH_SPECIAL_RATE_LIMIT_MAX exists for the shared HTTP test harness only: it
 * raises those default rules so suites can call them freely. Leave it unset
 * everywhere else.
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

  const specialMax = getPositiveIntegerEnv('AUTH_SPECIAL_RATE_LIMIT_MAX', 0);
  const specialRules = specialMax
    ? Object.fromEntries(
        BETTER_AUTH_SPECIAL_RULE_PATHS.map((path) => [
          path,
          { window: SPECIAL_RULE_WINDOW_SECONDS, max: specialMax },
        ]),
      )
    : {};

  return {
    enabled: true,
    customRules: {
      '/sign-in/*': rule,
      '/sign-up/*': { ...rule },
      ...specialRules,
    },
  };
}

/**
 * The request header Better Auth reads the client IP from for its limits.
 * Default x-forwarded-for, which Vercel overwrites with the client address.
 * Off Vercel (Docker Compose, plain `next start`) the web app's proxy passes
 * the client's own x-forwarded-for through, so point this at a header your
 * proxy overwrites, or clients can pick their own sign-in bucket. This is
 * independent of TRUST_PROXY_HOPS, which only affects Express `req.ip`.
 */
function getAuthIpAddressHeader(): string {
  const value = process.env.AUTH_IP_ADDRESS_HEADER?.trim().toLowerCase();

  if (!value || !HEADER_NAME_PATTERN.test(value)) {
    return DEFAULT_AUTH_IP_ADDRESS_HEADER;
  }

  return value;
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
 * x-forwarded-for, which keys the global Nest limit and the tenant admin
 * fallback. It does not affect Better Auth (see getAuthIpAddressHeader). One
 * hop matches Vercel, which overwrites the header with the client address.
 * Set TRUST_PROXY_HOPS=0 when no proxy in front overwrites or appends to it,
 * or clients can spoof their address.
 */
function getTrustProxyHops(): number {
  const rawValue = process.env.TRUST_PROXY_HOPS;

  if (!rawValue || !/^\d+$/.test(rawValue)) {
    return DEFAULT_TRUST_PROXY_HOPS;
  }

  return Number(rawValue);
}

/** One log line describing how clients are keyed; contains no secrets. */
function describeClientIpSettings(): string {
  return `Rate limits key clients by IP: sign-in/sign-up (Better Auth) read the "${getAuthIpAddressHeader()}" header; other routes (Express req.ip) trust ${getTrustProxyHops()} proxy hop(s) in x-forwarded-for.`;
}

export {
  describeClientIpSettings,
  getAuthIpAddressHeader,
  getAuthRateLimitOptions,
  getRateLimitThrottlerOptions,
  getTenantAdminThrottlerOptions,
  getTrustProxyHops,
};
