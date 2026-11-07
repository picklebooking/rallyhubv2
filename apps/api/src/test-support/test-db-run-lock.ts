import pg from 'pg';

/** Advisory-lock key for "a Jest run is using the test database". */
export const TEST_DB_RUN_LOCK_KEY = 726_150_034;

export type TestDbRunLock = { release: () => Promise<void> };

/**
 * Holds a Postgres session advisory lock for as long as the returned client
 * stays connected. Two Jest runs sharing one test database delete each other's
 * fixtures mid-test (seen as stray 401s and 404s), so the second run fails
 * fast instead. Postgres drops the lock on its own if the process dies.
 */
export async function acquireTestDbRunLock(
  connectionString: string,
  key: number = TEST_DB_RUN_LOCK_KEY,
): Promise<TestDbRunLock> {
  const client = new pg.Client({ connectionString });
  await client.connect();
  try {
    const result = await client.query<{ acquired: boolean }>(
      'SELECT pg_try_advisory_lock($1) AS acquired',
      [key],
    );
    if (!result.rows[0]?.acquired) {
      throw new Error(
        'Another Jest run is already using the test database (TEST_DATABASE_URL). ' +
          "Wait for it to finish: concurrent runs delete each other's fixtures.",
      );
    }
  } catch (error) {
    await client.end();
    throw error;
  }
  return { release: () => client.end() };
}
