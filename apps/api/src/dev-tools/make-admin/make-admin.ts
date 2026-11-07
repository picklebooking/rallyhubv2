/**
 * Dev-only: grant or revoke User.isPlatformAdmin by email.
 *
 *   npm run dev:make-admin -w api -- <email> [--revoke] [--remote=<host>]
 *
 * Lives under src/dev-tools so Jest/ESLint cover it, and is excluded from
 * tsconfig.build.json so it is not part of the production build. The ordering
 * and safety checks live in make-admin.runner.ts; this file only wires in
 * dotenv and the Prisma write.
 */
import { existsSync } from 'node:fs';
import { join } from 'node:path';

import { PrismaPg } from '@prisma/adapter-pg';
import { config as loadEnv } from 'dotenv';
import { PrismaClient } from '../../generated/prisma/client';
import { decideChange, findEnvFile } from './make-admin.logic';
import { type AdminUpdateResult, runMakeAdmin } from './make-admin.runner';

function loadApiEnvFile(): void {
  const envPath = findEnvFile(
    ['.env', 'apps/api/.env', join(__dirname, '../../../.env')],
    existsSync,
  );
  // dotenv does not override variables that are already set.
  if (envPath) loadEnv({ path: envPath });
}

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

runMakeAdmin(process.argv.slice(2), {
  env: process.env,
  loadEnvFile: loadApiEnvFile,
  setPlatformAdmin,
  log: (message) => console.log(message),
  error: (message) => console.error(message),
}).then(
  (code) => {
    process.exitCode = code;
  },
  () => {
    // runMakeAdmin handles DB errors itself; never echo raw messages here.
    console.error('make-admin failed: unexpected error.');
    process.exitCode = 1;
  },
);
