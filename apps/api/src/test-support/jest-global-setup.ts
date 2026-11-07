import { acquireTestDbRunLock, type TestDbRunLock } from './test-db-run-lock';

declare global {
  var __rallyhubTestDbRunLock: TestDbRunLock | undefined;
}

/** Takes the test-DB run lock once per Jest run (no-op without a test DB). */
export default async function globalSetup(): Promise<void> {
  const url = process.env.TEST_DATABASE_URL;
  if (!url) return;
  globalThis.__rallyhubTestDbRunLock = await acquireTestDbRunLock(url);
}
