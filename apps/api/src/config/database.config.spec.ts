import { getRuntimeDatabaseUrl } from './database.config';

const DIRECT = 'postgresql://user:pass@db.prisma.io:5432/postgres';
const POOLED = 'postgresql://user:pass@pooled.db.prisma.io:5432/postgres';

describe('getRuntimeDatabaseUrl', () => {
  it('prefers the pooled URL when it is set', () => {
    expect(
      getRuntimeDatabaseUrl({
        DATABASE_URL: DIRECT,
        DATABASE_POOLED_URL: POOLED,
      }),
    ).toBe(POOLED);
  });

  it('falls back to DATABASE_URL without a pooled URL', () => {
    expect(getRuntimeDatabaseUrl({ DATABASE_URL: DIRECT })).toBe(DIRECT);
  });

  it('treats a blank pooled URL as unset', () => {
    expect(
      getRuntimeDatabaseUrl({
        DATABASE_URL: DIRECT,
        DATABASE_POOLED_URL: '  ',
      }),
    ).toBe(DIRECT);
  });

  it('returns undefined when neither is set', () => {
    expect(getRuntimeDatabaseUrl({})).toBeUndefined();
  });
});
