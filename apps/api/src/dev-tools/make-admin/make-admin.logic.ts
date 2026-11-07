/**
 * Pure decision logic for the `dev:make-admin` command. No I/O here so it can be
 * unit-tested; the runner in make-admin.ts does env loading and the Prisma write.
 */

export type ParsedArgs =
  | { ok: true; email: string; revoke: boolean; remote: boolean }
  | { ok: false; error: string };

export type HostClassification =
  | { ok: true; isLocal: boolean; host: string }
  | { ok: false; error: string };

export type SafetyResult =
  | { ok: true; isLocal: boolean; host: string }
  | { ok: false; error: string };

export const USAGE =
  'Usage: npm run dev:make-admin -w api -- <email> [--revoke] [--remote]';

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]', '::1']);

/** Better Auth stores emails lowercased on sign-up, so match the same way. */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function parseMakeAdminArgs(argv: readonly string[]): ParsedArgs {
  let revoke = false;
  let remote = false;
  const positionals: string[] = [];

  for (const arg of argv) {
    if (arg === '--revoke') revoke = true;
    else if (arg === '--remote') remote = true;
    else if (arg.startsWith('--')) {
      return { ok: false, error: `Unknown option ${arg}. ${USAGE}` };
    } else positionals.push(arg);
  }

  if (positionals.length === 0) {
    return { ok: false, error: `An email argument is required. ${USAGE}` };
  }
  if (positionals.length > 1) {
    return {
      ok: false,
      error: `Pass exactly one email address. ${USAGE}`,
    };
  }

  const email = normalizeEmail(positionals[0]);
  if (!/^[^\s@]+@[^\s@]+$/.test(email)) {
    return {
      ok: false,
      error: `"${positionals[0]}" is not a valid email address.`,
    };
  }

  return { ok: true, email, revoke, remote };
}

/** Classifies a connection string by host only; never returns credentials. */
export function classifyDatabaseHost(databaseUrl: string): HostClassification {
  let url: URL;
  try {
    url = new URL(databaseUrl);
  } catch {
    return { ok: false, error: 'DATABASE_URL is not a valid connection URL.' };
  }

  const host = url.hostname.toLowerCase();
  if (host === '') {
    const socketDir = url.searchParams.get('host') ?? '';
    if (socketDir.startsWith('/')) {
      return { ok: true, isLocal: true, host: 'unix-socket' };
    }
    return { ok: false, error: 'DATABASE_URL has no host.' };
  }

  return { ok: true, isLocal: LOCAL_HOSTS.has(host), host };
}

export function evaluateSafety(input: {
  nodeEnv?: string;
  databaseUrl: string | undefined;
  remote: boolean;
}): SafetyResult {
  if (input.nodeEnv === 'production') {
    return {
      ok: false,
      error:
        'Refusing to run: NODE_ENV=production. This is a dev-only command.',
    };
  }
  if (!input.databaseUrl) {
    return {
      ok: false,
      error:
        'DATABASE_URL is required (set it in the environment or apps/api/.env).',
    };
  }

  const classified = classifyDatabaseHost(input.databaseUrl);
  if (!classified.ok) return classified;

  if (!classified.isLocal && !input.remote) {
    return {
      ok: false,
      error: `Refusing to modify non-local database host "${classified.host}" without --remote.`,
    };
  }

  return { ok: true, isLocal: classified.isLocal, host: classified.host };
}

export function decideChange(input: {
  current: boolean;
  desired: boolean;
}): 'update' | 'noop' {
  return input.current === input.desired ? 'noop' : 'update';
}
