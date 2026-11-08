import type { ThrottlerOptions } from '@nestjs/throttler';
import type { BetterAuthRateLimitOptions } from 'better-auth';

const DEFAULT_RATE_LIMIT_TTL_MS = 60_000;
const DEFAULT_RATE_LIMIT_MAX = 100;
const DEFAULT_RATE_LIMIT_BLOCK_DURATION_MS = 60_000;
const DEFAULT_AUTH_RATE_LIMIT_MAX = 5;
const DEFAULT_AUTH_RATE_LIMIT_WINDOW_SECONDS = 60;

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

export { getAuthRateLimitOptions, getRateLimitThrottlerOptions };
