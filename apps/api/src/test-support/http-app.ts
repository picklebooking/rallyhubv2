import {
  ValidationPipe,
  VersioningType,
  type INestApplication,
} from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { getTrustProxyHops } from '../config/rate-limit.config';

/** Refuse remote databases and accidental use of a development database. */
export function getTestDatabaseUrl(): string {
  const value = process.env.TEST_DATABASE_URL;
  if (!value) throw new Error('TEST_DATABASE_URL is required for HTTP tests');
  const url = new URL(value);
  if (
    !['postgres:', 'postgresql:'].includes(url.protocol) ||
    !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) ||
    url.pathname !== '/rallyhub_test' ||
    (url.port !== '' && url.port !== '5432') ||
    url.search !== ''
  ) {
    throw new Error(
      'TEST_DATABASE_URL must point to local PostgreSQL rallyhub_test on port 5432 without query parameters',
    );
  }
  return value;
}

/** Env vars that raise rate limits so suites can sign up many users quickly. */
const RAISED_RATE_LIMIT_ENV = {
  RATE_LIMIT_MAX: '100000',
  AUTH_RATE_LIMIT_MAX: '100000',
  AUTH_SPECIAL_RATE_LIMIT_MAX: '100000',
  TENANT_ADMIN_RATE_LIMIT_MAX: '100000',
} as const;

/** Pinned so a developer's shell cannot change how test clients are keyed. */
const CLIENT_IP_ENV = {
  TRUST_PROXY_HOPS: '1',
  AUTH_IP_ADDRESS_HEADER: 'x-forwarded-for',
} as const;

export type HttpTestAppOptions = {
  /** Keep the production rate limits instead of raising them for the suite. */
  realRateLimits?: boolean;
};

export async function createHttpTestApp(
  configureApp?: (app: INestApplication) => void,
  options: HttpTestAppOptions = {},
): Promise<INestApplication> {
  process.env.DATABASE_URL = getTestDatabaseUrl();
  delete process.env.AUTH_DEV_BYPASS_EMAIL;
  for (const [name, value] of Object.entries(RAISED_RATE_LIMIT_ENV)) {
    if (options.realRateLimits) delete process.env[name];
    else process.env[name] = value;
  }
  Object.assign(process.env, CLIENT_IP_ENV);
  process.env.BETTER_AUTH_SECRET =
    'http-harness-test-only-secret-at-least-32-characters';
  process.env.BETTER_AUTH_URL = 'http://localhost:3000';
  process.env.BETTER_AUTH_TRUSTED_ORIGINS = 'http://localhost:3000';
  process.env.GOOGLE_CLIENT_ID = 'http-harness-test-only-client';
  process.env.GOOGLE_CLIENT_SECRET = 'http-harness-test-only-secret';

  // AppModule reads the bypass switch at import time: configure it first.
  const { AppModule } = await import('../app.module');
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bodyParser: false,
    logger: false,
  });
  // Mirror main.ts so per-IP limits key on x-forwarded-for.
  app.set('trust proxy', getTrustProxyHops());
  app.enableVersioning({ type: VersioningType.URI });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  try {
    configureApp?.(app);
    await app.init();
    return app;
  } catch (error) {
    await app.close();
    throw error;
  }
}
