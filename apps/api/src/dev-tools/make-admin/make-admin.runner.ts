/**
 * Orchestration for `dev:make-admin`. Env loading and DB access are injected so
 * the ordering (parse -> load env -> safety -> DB) is unit-testable without a
 * database; make-admin.ts wires in dotenv and the Prisma write.
 */
import {
  describeDatabaseError,
  evaluateSafety,
  parseMakeAdminArgs,
} from './make-admin.logic';

export type AdminUpdateResult =
  | { found: false }
  | { found: true; email: string; before: boolean; after: boolean };

export interface MakeAdminDeps {
  /** Mutable env; loadEnvFile fills unset keys in it (dotenv, no override). */
  env: Record<string, string | undefined>;
  loadEnvFile: () => void;
  /** The only DB access. Must not be called unless every safety check passed. */
  setPlatformAdmin: (
    connectionString: string,
    email: string,
    desired: boolean,
  ) => Promise<AdminUpdateResult>;
  log: (message: string) => void;
  error: (message: string) => void;
}

export async function runMakeAdmin(
  argv: readonly string[],
  deps: MakeAdminDeps,
): Promise<number> {
  const args = parseMakeAdminArgs(argv);
  if (!args.ok) {
    deps.error(args.error);
    return 1;
  }

  // Always load the env file (dotenv never overrides set vars), so NODE_ENV and
  // PGHOST from apps/api/.env count even when DATABASE_URL came from the shell.
  deps.loadEnvFile();

  const databaseUrl = deps.env.DATABASE_URL;
  const safety = evaluateSafety({
    nodeEnv: deps.env.NODE_ENV,
    databaseUrl,
    remoteHost: args.remoteHost,
    pgHost: deps.env.PGHOST,
  });
  if (!safety.ok || databaseUrl === undefined) {
    deps.error(safety.ok ? 'DATABASE_URL is required.' : safety.error);
    return 1;
  }
  if (!safety.isLocal) {
    deps.log(`Using remote database host: ${safety.host}`);
  }

  const desired = !args.revoke;
  let result: AdminUpdateResult;
  try {
    result = await deps.setPlatformAdmin(databaseUrl, args.email, desired);
  } catch (error: unknown) {
    deps.error(describeDatabaseError(error, safety.host));
    return 1;
  }

  if (!result.found) {
    deps.error(`No user found with email ${args.email}.`);
    return 1;
  }
  if (result.before === desired) {
    deps.log(
      `${result.email} already has isPlatformAdmin=${String(desired)}; nothing to change.`,
    );
  } else {
    deps.log(
      `${result.email}: isPlatformAdmin ${String(result.before)} -> ${String(result.after)}`,
    );
  }
  return 0;
}
