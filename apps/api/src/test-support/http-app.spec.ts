import { getTestDatabaseUrl } from './http-app';

describe('HTTP harness database URL guard', () => {
  const originalUrl = process.env.TEST_DATABASE_URL;

  afterEach(() => {
    if (originalUrl === undefined) delete process.env.TEST_DATABASE_URL;
    else process.env.TEST_DATABASE_URL = originalUrl;
  });

  it.each([
    'postgresql://jpatrickzxc@localhost:5432/rallyhub_test',
    'postgresql://jpatrickzxc@127.0.0.1/rallyhub_test',
    'postgres://jpatrickzxc@[::1]:5432/rallyhub_test',
  ])('accepts the authorized local database: %s', (url) => {
    process.env.TEST_DATABASE_URL = url;
    expect(getTestDatabaseUrl()).toBe(url);
  });

  it('rejects a missing database URL', () => {
    delete process.env.TEST_DATABASE_URL;
    expect(() => getTestDatabaseUrl()).toThrow('TEST_DATABASE_URL is required');
  });

  it.each([
    'postgresql://jpatrickzxc@localhost:5432/rallyhub_test?host=remote.example',
    'postgresql://jpatrickzxc@localhost:5432/rallyhub_test?sslmode=disable',
    'postgresql://jpatrickzxc@localhost:5432/another_test',
    'postgresql://jpatrickzxc@localhost:5433/rallyhub_test',
    'postgresql://jpatrickzxc@remote.example:5432/rallyhub_test',
  ])('rejects a database outside the authorized target: %s', (url) => {
    process.env.TEST_DATABASE_URL = url;
    expect(() => getTestDatabaseUrl()).toThrow();
  });
});
