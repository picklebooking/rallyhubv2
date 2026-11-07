import {
  ValidationPipe,
  VersioningType,
  type INestApplication,
} from '@nestjs/common';
import { NestFactory } from '@nestjs/core';

/** Refuse remote databases and accidental use of a development database. */
export function getTestDatabaseUrl(): string {
  const value = process.env.TEST_DATABASE_URL;
  if (!value) throw new Error('TEST_DATABASE_URL is required for HTTP tests');
  const url = new URL(value);
  if (
    !['postgres:', 'postgresql:'].includes(url.protocol) ||
    !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) ||
    !url.pathname.endsWith('_test')
  ) {
    throw new Error(
      'TEST_DATABASE_URL must point to a local PostgreSQL database ending in _test',
    );
  }
  return value;
}

export async function createHttpTestApp(): Promise<INestApplication> {
  process.env.DATABASE_URL = getTestDatabaseUrl();
  delete process.env.AUTH_DEV_BYPASS_EMAIL;
  process.env.RATE_LIMIT_MAX = '100000';
  process.env.BETTER_AUTH_SECRET =
    'http-harness-test-only-secret-at-least-32-characters';
  process.env.BETTER_AUTH_URL = 'http://localhost:3000';
  process.env.BETTER_AUTH_TRUSTED_ORIGINS = 'http://localhost:3000';
  process.env.GOOGLE_CLIENT_ID = 'http-harness-test-only-client';
  process.env.GOOGLE_CLIENT_SECRET = 'http-harness-test-only-secret';

  // AppModule reads the bypass switch at import time: configure it first.
  const { AppModule } = await import('../app.module');
  const app = await NestFactory.create(AppModule, {
    bodyParser: false,
    logger: false,
  });
  app.enableVersioning({ type: VersioningType.URI });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  try {
    await app.init();
    return app;
  } catch (error) {
    await app.close();
    throw error;
  }
}
