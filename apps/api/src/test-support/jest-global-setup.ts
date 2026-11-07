import { acquireTestDbRunLock, type TestDbRunLock } from './test-db-run-lock';

declare global {
  var __rallyhubTestDbRunLock: TestDbRunLock | undefined;
}

/** Takes the test-DB run lock once per Jest run (no-op without a test DB, except in CI where it fails). */
export default async function globalSetup(): Promise<void> {
  const url = process.env.TEST_DATABASE_URL;
  if (!url) {
    if (process.env.CI) {
      throw new Error(
        'TEST_DATABASE_URL must be set when CI is set; the DB-backed suites would otherwise be skipped',
      );
    }
    return;
  }
  globalThis.__rallyhubTestDbRunLock = await acquireTestDbRunLock(url);
}
