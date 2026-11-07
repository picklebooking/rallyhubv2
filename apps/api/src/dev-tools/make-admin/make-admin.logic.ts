/**
 * Pure decision logic for the `dev:make-admin` command. No I/O here so it can be
 * unit-tested; the runner in make-admin.ts does env loading and the Prisma write.
 */

export type ParsedArgs =
  | { ok: true; email: string; revoke: boolean; remoteHost: string | null }
  | { ok: false; error: string };

export type HostClassification =
  | { ok: true; isLocal: boolean; host: string }
  | { ok: false; error: string };

export type SafetyResult =
  | { ok: true; isLocal: boolean; host: string }
  | { ok: false; error: string };

export const USAGE =
  'Usage: npm run dev:make-admin -w api -- <email> [--revoke] [--remote=<host>]';

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]', '::1']);

/**
 * Unix-socket directories a local Postgres listens on. Any other socket path
 * (e.g. /cloudsql/... behind the Cloud SQL proxy) can reach a remote instance,
 * so it is treated as remote.
 */
const LOCAL_SOCKET_DIRS = new Set([
  '/tmp',
  '/private/tmp',
  '/var/run/postgresql',
  '/run/postgresql',
]);

/** pg's own fallback when neither the URL, a `host` param nor PGHOST names one. */
const PG_DEFAULT_HOST = 'localhost';

const REMOTE_FLAG = '--remote';

/** Better Auth stores emails lowercased on sign-up, so match the same way. */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function parseMakeAdminArgs(argv: readonly string[]): ParsedArgs {
  let revoke = false;
  let remoteHost: string | null = null;
  const positionals: string[] = [];

  for (const arg of argv) {
    if (arg === '--revoke') revoke = true;
    else if (arg === REMOTE_FLAG || arg.startsWith(`${REMOTE_FLAG}=`)) {
      const value = arg.slice(REMOTE_FLAG.length + 1).trim();
      if (value === '') {
        return {
          ok: false,
          error: `${REMOTE_FLAG} needs the database host you expect: --remote=<host>. ${USAGE}`,
        };
      }
      remoteHost = normalizeHost(value);
    } else if (arg.startsWith('--')) {
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

  return { ok: true, email, revoke, remoteHost };
}

function normalizeHost(host: string): string {
  // Socket paths are case-sensitive; hostnames are not.
  return host.startsWith('/') ? host : host.toLowerCase();
}

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function isLocalHost(host: string): boolean {
  if (host.startsWith('/')) {
    return LOCAL_SOCKET_DIRS.has(host.replace(/\/+$/, '') || '/');
  }
  return LOCAL_HOSTS.has(host);
}

const EMPTY_HOST_MARKER = '___empty_host___';

/** Same fallback as pg-connection-string for `user:pass@/db` (no host). */
function parseConnectionUrl(databaseUrl: string): URL | null {
  try {
    return new URL(databaseUrl);
  } catch {
    try {
      return new URL(databaseUrl.replace('@/', `@${EMPTY_HOST_MARKER}/`));
    } catch {
      return null;
    }
  }
}

/**
 * Classifies a connection string by the host pg will actually connect to, and
 * never returns credentials. Mirrors pg / pg-connection-string precedence:
 * a `host` query parameter beats the URL hostname, and PGHOST is only used when
 * neither names a host (then pg falls back to localhost).
 */
export function classifyDatabaseHost(
  databaseUrl: string,
  env: { PGHOST?: string } = {},
): HostClassification {
  const url = parseConnectionUrl(databaseUrl);
  if (!url) {
    return { ok: false, error: 'DATABASE_URL is not a valid connection URL.' };
  }
  if (url.protocol !== 'postgresql:' && url.protocol !== 'postgres:') {
    return {
      ok: false,
      error: 'DATABASE_URL must start with postgresql:// or postgres://.',
    };
  }

  const hostname =
    url.hostname === EMPTY_HOST_MARKER ? '' : safeDecode(url.hostname);
  const hostParam = url.searchParams.get('host') ?? '';
  const pgHost = env.PGHOST?.trim() ?? '';
  const host = normalizeHost(
    hostParam || hostname || pgHost || PG_DEFAULT_HOST,
  );

  return { ok: true, isLocal: isLocalHost(host), host };
}

export function evaluateSafety(input: {
  nodeEnv?: string;
  databaseUrl: string | undefined;
  remoteHost: string | null;
  pgHost?: string;
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

  const classified = classifyDatabaseHost(input.databaseUrl, {
    PGHOST: input.pgHost,
  });
  if (!classified.ok) return classified;

  if (input.remoteHost !== null && input.remoteHost !== classified.host) {
    return {
      ok: false,
      error: `Refusing to run: --remote=${input.remoteHost} does not match the database host "${classified.host}".`,
    };
  }
  if (!classified.isLocal && input.remoteHost === null) {
    return {
      ok: false,
      error: `Refusing to modify non-local database host "${classified.host}". If that is the database you mean, pass --remote=${classified.host}.`,
    };
  }

  return { ok: true, isLocal: classified.isLocal, host: classified.host };
}

/** First env file that exists, in candidate order. */
export function findEnvFile(
  candidates: readonly string[],
  exists: (path: string) => boolean,
): string | undefined {
  return candidates.find((path) => exists(path));
}

const ERROR_CODE_PATTERN = /^[A-Za-z0-9_]{1,32}$/;

function readErrorCode(error: unknown, depth = 0): string | undefined {
  if (depth > 3 || typeof error !== 'object' || error === null) {
    return undefined;
  }
  const code = (error as { code?: unknown }).code;
  if (typeof code === 'string' && ERROR_CODE_PATTERN.test(code)) return code;
  return readErrorCode((error as { cause?: unknown }).cause, depth + 1);
}

/**
 * Driver messages can name the DB user (e.g. pg's "password authentication
 * failed for user ..."), so only a fixed message, the host and the code are
 * ever printed.
 */
export function describeDatabaseError(error: unknown, host: string): string {
  const code = readErrorCode(error);
  return `make-admin failed: database operation on host "${host}" failed (${
    code ? `code ${code}` : 'no error code'
  }).`;
}

export function decideChange(input: {
  current: boolean;
  desired: boolean;
}): 'update' | 'noop' {
  return input.current === input.desired ? 'noop' : 'update';
}
