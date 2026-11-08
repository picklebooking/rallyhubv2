import { existsSync } from 'node:fs';
import { join } from 'node:path';

import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { config as loadEnv } from 'dotenv';
import { getRuntimeDatabaseUrl } from '../config/database.config';
import { PrismaClient } from '../generated/prisma/client';
import type { PrismaClient as PrismaClientType } from '../generated/prisma/client';

@Injectable()
export class PrismaService implements OnModuleDestroy {
  readonly db: PrismaClientType;

  constructor() {
    if (!process.env.DATABASE_URL) {
      const envPath = [
        '.env',
        'apps/api/.env',
        join(__dirname, '../../.env'),
      ].find((path) => existsSync(path));

      if (envPath) {
        loadEnv({ path: envPath });
      }
    }

    // Pooled when DATABASE_POOLED_URL is set (Vercel), else DATABASE_URL.
    const connectionString = getRuntimeDatabaseUrl();

    if (!connectionString) {
      throw new Error('DATABASE_URL is required to initialize Prisma');
    }

    this.db = new PrismaClient({
      adapter: new PrismaPg(connectionString),
    });
  }

  async onModuleDestroy(): Promise<void> {
    await this.db.$disconnect();
  }
}
