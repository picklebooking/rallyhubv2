import type { TestDbRunLock } from './test-db-run-lock';

/** Releases the run lock taken in jest-global-setup.ts. */
export default async function globalTeardown(): Promise<void> {
  const lock = (globalThis as { __rallyhubTestDbRunLock?: TestDbRunLock })
    .__rallyhubTestDbRunLock;
  await lock?.release();
}
