/**
 * Dev-only: grant or revoke User.isPlatformAdmin by email.
 *
 *   npm run dev:make-admin -w api -- <email> [--revoke] [--remote]
 *
 * Lives under src/dev-tools so Jest/ESLint cover it, and is excluded from
 * tsconfig.build.json so it is not part of the production build.
 */
import { existsSync } from 'node:fs';
import { join } from 'node:path';

import { PrismaPg } from '@prisma/adapter-pg';
import { config as loadEnv } from 'dotenv';
import { PrismaClient } from '../../generated/prisma/client';
import {
  decideChange,
  evaluateSafety,
  parseMakeAdminArgs,
} from './make-admin.logic';

function loadDatabaseUrlFromEnvFile(): void {
  if (process.env.DATABASE_URL) return;
  const envPath = [
    '.env',
    'apps/api/.env',
    join(__dirname, '../../../.env'),
  ].find((path) => existsSync(path));
  if (envPath) loadEnv({ path: envPath });
}

type AdminUpdateResult =
  | { found: false }
  | { found: true; email: string; before: boolean; after: boolean };

async function setPlatformAdmin(
  connectionString: string,
  email: string,
  desired: boolean,
): Promise<AdminUpdateResult> {
  const db = new PrismaClient({ adapter: new PrismaPg(connectionString) });
  try {
    const user = await db.user.findUnique({
      where: { email },
      select: { id: true, email: true, isPlatformAdmin: true },
    });
    if (!user) return { found: false };

    const before = user.isPlatformAdmin;
    if (decideChange({ current: before, desired }) === 'update') {
      await db.user.update({
        where: { id: user.id },
        data: { isPlatformAdmin: desired },
      });
    }
    return { found: true, email: user.email, before, after: desired };
  } finally {
    await db.$disconnect();
  }
}

async function main(): Promise<number> {
  const args = parseMakeAdminArgs(process.argv.slice(2));
  if (!args.ok) {
    console.error(args.error);
    return 1;
  }

  loadDatabaseUrlFromEnvFile();
  const safety = evaluateSafety({
    nodeEnv: process.env.NODE_ENV,
    databaseUrl: process.env.DATABASE_URL,
    remote: args.remote,
  });
  if (!safety.ok) {
    console.error(safety.error);
    return 1;
  }
  if (!safety.isLocal) {
    console.log(`Using remote database host: ${safety.host}`);
  }

  const desired = !args.revoke;
  const result = await setPlatformAdmin(
    process.env.DATABASE_URL as string,
    args.email,
    desired,
  );
  if (!result.found) {
    console.error(`No user found with email ${args.email}.`);
    return 1;
  }

  if (result.before === desired) {
    console.log(
      `${result.email} already has isPlatformAdmin=${String(desired)}; nothing to change.`,
    );
  } else {
    console.log(
      `${result.email}: isPlatformAdmin ${String(result.before)} -> ${String(result.after)}`,
    );
  }
  return 0;
}

main().then(
  (code) => {
    process.exitCode = code;
  },
  (error: unknown) => {
    console.error(
      `make-admin failed: ${error instanceof Error ? error.message : 'unknown error'}`,
    );
    process.exitCode = 1;
  },
);
