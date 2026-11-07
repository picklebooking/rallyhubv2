import globalSetup from './jest-global-setup';

describe('jest global setup CI guard', () => {
  let originalCi: string | undefined;
  let originalUrl: string | undefined;

  beforeEach(() => {
    originalCi = process.env.CI;
    originalUrl = process.env.TEST_DATABASE_URL;
  });

  afterEach(() => {
    if (originalCi === undefined) delete process.env.CI;
    else process.env.CI = originalCi;
    if (originalUrl === undefined) delete process.env.TEST_DATABASE_URL;
    else process.env.TEST_DATABASE_URL = originalUrl;
  });

  it('fails a CI run that has no TEST_DATABASE_URL', async () => {
    process.env.CI = 'true';
    delete process.env.TEST_DATABASE_URL;

    await expect(globalSetup()).rejects.toThrow('TEST_DATABASE_URL');
  });

  it('skips quietly outside CI without TEST_DATABASE_URL', async () => {
    delete process.env.CI;
    delete process.env.TEST_DATABASE_URL;
    const lockBefore = globalThis.__rallyhubTestDbRunLock;

    await expect(globalSetup()).resolves.toBeUndefined();
    expect(globalThis.__rallyhubTestDbRunLock).toBe(lockBefore);
  });
});
