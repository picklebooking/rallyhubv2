import {
  classifyDatabaseHost,
  decideChange,
  describeDatabaseError,
  evaluateSafety,
  findEnvFile,
  parseMakeAdminArgs,
} from './make-admin.logic';

describe('parseMakeAdminArgs', () => {
  it('parses a grant request', () => {
    expect(parseMakeAdminArgs(['Dev@Example.com'])).toEqual({
      ok: true,
      email: 'dev@example.com',
      revoke: false,
      remoteHost: null,
    });
  });

  it('parses --revoke and --remote=<host> in any position', () => {
    expect(
      parseMakeAdminArgs(['--remote=DB.Example.invalid', 'a@b.co', '--revoke']),
    ).toEqual({
      ok: true,
      email: 'a@b.co',
      revoke: true,
      remoteHost: 'db.example.invalid',
    });
  });

  it.each([['--remote'], ['--remote=']])(
    'rejects %s without a host and explains --remote=<host>',
    (flag) => {
      const result = parseMakeAdminArgs(['a@b.co', flag]);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error).toContain('--remote=<host>');
    },
  );

  it('trims the email', () => {
    expect(parseMakeAdminArgs(['  a@b.co '])).toMatchObject({
      ok: true,
      email: 'a@b.co',
    });
  });

  it.each([
    [[], /email/i],
    [['not-an-email'], /valid email/i],
    [['a@b.co', 'c@d.co'], /exactly one/i],
    [['a@b.co', '--force'], /unknown option.*--force/i],
  ])('rejects %j', (argv, message) => {
    const result = parseMakeAdminArgs(argv);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(message);
  });
});

describe('classifyDatabaseHost', () => {
  it.each([
    'postgresql://u:p@localhost:5432/db',
    'postgresql://u@127.0.0.1/db',
    'postgresql://u@[::1]:5432/db',
    'postgres://u@LOCALHOST/db',
  ])('treats %s as local', (url) => {
    expect(classifyDatabaseHost(url)).toMatchObject({
      ok: true,
      isLocal: true,
    });
  });

  it('treats a unix socket host as local', () => {
    expect(
      classifyDatabaseHost('postgresql:///db?host=/var/run/postgresql'),
    ).toMatchObject({ ok: true, isLocal: true });
  });

  it('treats other hosts as remote and returns only the hostname', () => {
    const result = classifyDatabaseHost(
      'postgresql://user:secret@db.example.invalid:5432/z',
    );
    expect(result).toEqual({
      ok: true,
      isLocal: false,
      host: 'db.example.invalid',
    });
    expect(JSON.stringify(result)).not.toMatch(/secret|user/);
  });

  it.each([
    'postgresql://u:p@localhost:5432/db?host=db.example.invalid',
    'postgresql://u:p@127.0.0.1/db?host=DB.Example.invalid',
    'postgresql://u:p@/db?host=db.example.invalid',
  ])('lets a host query parameter override the hostname (%s)', (url) => {
    expect(classifyDatabaseHost(url)).toEqual({
      ok: true,
      isLocal: false,
      host: 'db.example.invalid',
    });
  });

  it('treats a local host query parameter as local', () => {
    expect(
      classifyDatabaseHost(
        'postgresql://u@db.example.invalid/db?host=localhost',
      ),
    ).toEqual({ ok: true, isLocal: true, host: 'localhost' });
  });

  it('treats a non-standard socket directory (e.g. a Cloud SQL proxy) as remote', () => {
    expect(
      classifyDatabaseHost(
        'postgresql://u:p@/db?host=/cloudsql/proj:region:inst',
      ),
    ).toEqual({
      ok: true,
      isLocal: false,
      host: '/cloudsql/proj:region:inst',
    });
  });

  it('treats a URL-encoded local socket hostname as local', () => {
    expect(classifyDatabaseHost('postgresql://u@%2Ftmp/db')).toMatchObject({
      ok: true,
      isLocal: true,
    });
  });

  it('uses PGHOST when the URL has no host, as pg does', () => {
    expect(
      classifyDatabaseHost('postgresql:///db', {
        PGHOST: 'db.example.invalid',
      }),
    ).toEqual({ ok: true, isLocal: false, host: 'db.example.invalid' });
    expect(
      classifyDatabaseHost('postgresql://u:p@/db', { PGHOST: 'localhost' }),
    ).toEqual({ ok: true, isLocal: true, host: 'localhost' });
  });

  it('ignores PGHOST when the URL names a host, as pg does', () => {
    expect(
      classifyDatabaseHost('postgresql://u@localhost/db', {
        PGHOST: 'db.example.invalid',
      }),
    ).toEqual({ ok: true, isLocal: true, host: 'localhost' });
  });

  it('falls back to localhost when neither the URL nor PGHOST names a host', () => {
    expect(classifyDatabaseHost('postgresql:///db', {})).toEqual({
      ok: true,
      isLocal: true,
      host: 'localhost',
    });
  });

  it('rejects a non-postgres scheme', () => {
    const result = classifyDatabaseHost('mysql://u:p@localhost/db');
    expect(result.ok).toBe(false);
    expect(JSON.stringify(result)).not.toContain('u:p');
  });

  it('fails on an unparseable URL without echoing it', () => {
    const result = classifyDatabaseHost('not a url with secret');
    expect(result.ok).toBe(false);
    expect(JSON.stringify(result)).not.toContain('secret');
  });
});

describe('evaluateSafety', () => {
  const local = 'postgresql://u@localhost:5432/db';
  const remoteUrl = 'postgresql://u:p@db.example.invalid:5432/db';

  it('refuses in production', () => {
    const result = evaluateSafety({
      nodeEnv: 'production',
      databaseUrl: local,
      remoteHost: 'localhost',
    });
    expect(result).toMatchObject({ ok: false });
    if (!result.ok) expect(result.error).toMatch(/production/i);
  });

  it('requires DATABASE_URL', () => {
    const result = evaluateSafety({ databaseUrl: undefined, remoteHost: null });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/DATABASE_URL/);
  });

  it('allows a local database without --remote', () => {
    expect(
      evaluateSafety({
        nodeEnv: 'development',
        databaseUrl: local,
        remoteHost: null,
      }),
    ).toEqual({ ok: true, host: 'localhost', isLocal: true });
  });

  it('refuses a non-local host without --remote and names only the host', () => {
    const result = evaluateSafety({ databaseUrl: remoteUrl, remoteHost: null });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain('--remote=db.example.invalid');
      expect(result.error).not.toMatch(/:p@|u:/);
    }
  });

  it('allows a non-local host when --remote names that host', () => {
    expect(
      evaluateSafety({
        databaseUrl: remoteUrl,
        remoteHost: 'db.example.invalid',
      }),
    ).toEqual({ ok: true, host: 'db.example.invalid', isLocal: false });
  });

  it('refuses when --remote names a different host than DATABASE_URL', () => {
    const result = evaluateSafety({
      databaseUrl: 'postgresql://u:p@prod.example.invalid:5432/db',
      remoteHost: 'dev.example.invalid',
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain('dev.example.invalid');
      expect(result.error).toContain('prod.example.invalid');
      expect(result.error).not.toMatch(/:p@|u:/);
    }
  });

  it('refuses when --remote is given for a local database with another host', () => {
    expect(
      evaluateSafety({ databaseUrl: local, remoteHost: 'db.example.invalid' }),
    ).toMatchObject({ ok: false });
  });

  it('applies a host query parameter override to the --remote gate', () => {
    const sneaky = 'postgresql://u:p@localhost:5432/db?host=db.example.invalid';
    expect(
      evaluateSafety({ databaseUrl: sneaky, remoteHost: null }),
    ).toMatchObject({ ok: false });
    expect(
      evaluateSafety({ databaseUrl: sneaky, remoteHost: 'db.example.invalid' }),
    ).toEqual({ ok: true, isLocal: false, host: 'db.example.invalid' });
  });

  it('applies PGHOST to the --remote gate when the URL has no host', () => {
    expect(
      evaluateSafety({
        databaseUrl: 'postgresql:///db',
        remoteHost: null,
        pgHost: 'db.example.invalid',
      }),
    ).toMatchObject({ ok: false });
  });
});

describe('findEnvFile', () => {
  it('returns the first candidate that exists', () => {
    const existing = new Set(['apps/api/.env', '/abs/.env']);
    expect(
      findEnvFile(['.env', 'apps/api/.env', '/abs/.env'], (p) =>
        existing.has(p),
      ),
    ).toBe('apps/api/.env');
  });

  it('returns undefined when no candidate exists', () => {
    expect(findEnvFile(['.env'], () => false)).toBeUndefined();
  });
});

describe('describeDatabaseError', () => {
  it('prints only a generic message, the host and the error code', () => {
    const error = Object.assign(
      new Error('password authentication failed for user "alice_db"'),
      { code: '28P01' },
    );
    const message = describeDatabaseError(error, 'db.example.invalid');
    expect(message).toContain('db.example.invalid');
    expect(message).toContain('28P01');
    expect(message).not.toContain('alice_db');
    expect(message).not.toContain('password authentication');
  });

  it('reads the code from a nested cause', () => {
    const error = new Error('wrapped', {
      cause: Object.assign(new Error('connect ECONNREFUSED'), {
        code: 'ECONNREFUSED',
      }),
    });
    expect(describeDatabaseError(error, 'localhost')).toContain('ECONNREFUSED');
  });

  it('drops a code that does not look like an error code', () => {
    const error = Object.assign(new Error('x'), {
      code: 'user "alice_db" denied',
    });
    const message = describeDatabaseError(error, 'localhost');
    expect(message).not.toContain('alice_db');
    expect(message).toMatch(/no error code/i);
  });

  it('handles non-Error values', () => {
    expect(describeDatabaseError('boom alice_db', 'localhost')).not.toContain(
      'alice_db',
    );
  });
});

describe('decideChange', () => {
  it('updates when the state differs', () => {
    expect(decideChange({ current: false, desired: true })).toBe('update');
    expect(decideChange({ current: true, desired: false })).toBe('update');
  });

  it('is a no-op when already in the desired state', () => {
    expect(decideChange({ current: true, desired: true })).toBe('noop');
    expect(decideChange({ current: false, desired: false })).toBe('noop');
  });
});
