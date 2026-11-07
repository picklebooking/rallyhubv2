import { randomInt } from 'node:crypto';
import { acquireTestDbRunLock } from './test-db-run-lock';

const describeIfDb = process.env.TEST_DATABASE_URL ? describe : describe.skip;

describeIfDb('test DB run lock (requires TEST_DATABASE_URL)', () => {
  // A key of its own, so this suite never collides with the real run lock
  // that globalSetup already holds while these tests execute.
  const key = randomInt(1_000_000, 2_000_000_000);
  const url = (): string => process.env.TEST_DATABASE_URL as string;

  it('refuses a second holder until the first releases', async () => {
    const first = await acquireTestDbRunLock(url(), key);
    try {
      await expect(acquireTestDbRunLock(url(), key)).rejects.toThrow(
        'Another Jest run is already using the test database',
      );
    } finally {
      await first.release();
    }
    const again = await acquireTestDbRunLock(url(), key);
    await again.release();
  });
});
