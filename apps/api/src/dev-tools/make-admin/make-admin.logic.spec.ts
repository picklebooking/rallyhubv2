import {
  classifyDatabaseHost,
  decideChange,
  evaluateSafety,
  parseMakeAdminArgs,
} from './make-admin.logic';

describe('parseMakeAdminArgs', () => {
  it('parses a grant request', () => {
    expect(parseMakeAdminArgs(['Dev@Example.com'])).toEqual({
      ok: true,
      email: 'dev@example.com',
      revoke: false,
      remote: false,
    });
  });

  it('parses --revoke and --remote in any position', () => {
    expect(parseMakeAdminArgs(['--remote', 'a@b.co', '--revoke'])).toEqual({
      ok: true,
      email: 'a@b.co',
      revoke: true,
      remote: true,
    });
  });

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
      remote: true,
    });
    expect(result).toMatchObject({ ok: false });
    if (!result.ok) expect(result.error).toMatch(/production/i);
  });

  it('requires DATABASE_URL', () => {
    const result = evaluateSafety({ databaseUrl: undefined, remote: false });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/DATABASE_URL/);
  });

  it('allows a local database without --remote', () => {
    expect(
      evaluateSafety({
        nodeEnv: 'development',
        databaseUrl: local,
        remote: false,
      }),
    ).toEqual({ ok: true, host: 'localhost', isLocal: true });
  });

  it('refuses a non-local host without --remote and names only the host', () => {
    const result = evaluateSafety({ databaseUrl: remoteUrl, remote: false });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/--remote/);
      expect(result.error).toContain('db.example.invalid');
      expect(result.error).not.toMatch(/:p@|u:/);
    }
  });

  it('allows a non-local host with --remote', () => {
    expect(evaluateSafety({ databaseUrl: remoteUrl, remote: true })).toEqual({
      ok: true,
      host: 'db.example.invalid',
      isLocal: false,
    });
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
