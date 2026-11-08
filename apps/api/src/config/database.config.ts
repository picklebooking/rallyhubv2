type DatabaseEnv = Partial<
  Record<'DATABASE_URL' | 'DATABASE_POOLED_URL', string>
>;

/**
 * Connection string the running API uses.
 *
 * DATABASE_URL is the direct connection: Prisma CLI commands (migrations) and
 * dev tools always use it, because the pooler runs PgBouncer in transaction
 * mode, which breaks the advisory locks `prisma migrate deploy` takes.
 * Serverless instances should use the pooled connection instead, since direct
 * connections are capped low (10 on Prisma Postgres Free and Starter), so the
 * app prefers DATABASE_POOLED_URL and falls back to DATABASE_URL.
 */
export function getRuntimeDatabaseUrl(
  env: DatabaseEnv = process.env,
): string | undefined {
  const pooled = env.DATABASE_POOLED_URL?.trim();
  return pooled ? pooled : env.DATABASE_URL;
}
