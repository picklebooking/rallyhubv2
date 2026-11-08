// Must stay first: lets the Vercel build find apps/api/node_modules.
import './register-module-paths';

import { existsSync } from 'node:fs';

import { Logger, ValidationPipe, VersioningType } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import {
  describeClientIpSettings,
  getTrustProxyHops,
} from './config/rate-limit.config';

async function bootstrap() {
  if (existsSync('.env')) {
    process.loadEnvFile('.env');
  }

  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bodyParser: false,
  });
  // Per-IP rate limits must see the client, not the proxy in front of us.
  app.set('trust proxy', getTrustProxyHops());
  new Logger('RateLimit').log(describeClientIpSettings());
  const corsOrigin = process.env.CORS_ORIGIN;

  if (corsOrigin) {
    app.enableCors({
      origin: corsOrigin.split(',').map((origin) => origin.trim()),
      credentials: true,
    });
  }

  app.enableVersioning({
    type: VersioningType.URI,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
    }),
  );

  await app.listen(Number(process.env.PORT ?? 3000));
}
void bootstrap();
