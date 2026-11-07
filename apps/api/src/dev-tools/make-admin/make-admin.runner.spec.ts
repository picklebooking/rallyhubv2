import { jest } from '@jest/globals';

import {
  type AdminUpdateResult,
  type MakeAdminDeps,
  runMakeAdmin,
} from './make-admin.runner';

const LOCAL_URL = 'postgresql://u@localhost:5432/db';
const REMOTE_URL = 'postgresql://alice_db:secret@db.example.invalid:5432/db';

function makeDeps(
  env: Record<string, string | undefined>,
  options: {
    envFile?: Record<string, string>;
    result?: AdminUpdateResult;
    throws?: Error;
  } = {},
): {
  deps: MakeAdminDeps;
  calls: string[];
  out: string[];
  err: string[];
  setPlatformAdmin: jest.Mock<MakeAdminDeps['setPlatformAdmin']>;
} {
  const calls: string[] = [];
  const out: string[] = [];
  const err: string[] = [];
  const setPlatformAdmin = jest.fn<MakeAdminDeps['setPlatformAdmin']>(
    (_connectionString, email, desired) => {
      calls.push(`db:${email}:${String(desired)}`);
      if (options.throws) {
        return Promise.reject(options.throws);
      }
      return Promise.resolve(
        options.result ?? {
          found: true,
          email,
          before: !desired,
          after: desired,
        },
      );
    },
  );
  const deps: MakeAdminDeps = {
    env,
    loadEnvFile: () => {
      calls.push('loadEnvFile');
      // dotenv semantics: never override what is already set.
      for (const [key, value] of Object.entries(options.envFile ?? {})) {
        if (env[key] === undefined) env[key] = value;
      }
    },
    setPlatformAdmin,
    log: (message) => out.push(message),
    error: (message) => err.push(message),
  };
  return { deps, calls, out, err, setPlatformAdmin };
}

describe('runMakeAdmin', () => {
  it('grants on a local database and reports the change', async () => {
    const { deps, out, setPlatformAdmin } = makeDeps({
      DATABASE_URL: LOCAL_URL,
    });
    await expect(runMakeAdmin(['A@b.co'], deps)).resolves.toBe(0);
    expect(setPlatformAdmin).toHaveBeenCalledWith(LOCAL_URL, 'a@b.co', true);
    expect(out.join('\n')).toContain('a@b.co: isPlatformAdmin false -> true');
  });

  it('reports an already-granted user and exits 0', async () => {
    const { deps, out } = makeDeps(
      { DATABASE_URL: LOCAL_URL },
      { result: { found: true, email: 'a@b.co', before: true, after: true } },
    );
    await expect(runMakeAdmin(['a@b.co'], deps)).resolves.toBe(0);
    expect(out.join('\n')).toMatch(/already has isPlatformAdmin=true/);
  });

  it('exits 1 for an unknown email', async () => {
    const { deps, err } = makeDeps(
      { DATABASE_URL: LOCAL_URL },
      { result: { found: false } },
    );
    await expect(runMakeAdmin(['a@b.co'], deps)).resolves.toBe(1);
    expect(err.join('\n')).toMatch(/No user found/);
  });

  it('exits 1 on bad arguments before loading the env file or the DB', async () => {
    const { deps, calls } = makeDeps({ DATABASE_URL: LOCAL_URL });
    await expect(runMakeAdmin([], deps)).resolves.toBe(1);
    expect(calls).toEqual([]);
  });

  it('loads the env file even when DATABASE_URL is already set, so NODE_ENV from it is honoured', async () => {
    const { deps, calls, err, setPlatformAdmin } = makeDeps(
      { DATABASE_URL: LOCAL_URL },
      { envFile: { NODE_ENV: 'production', DATABASE_URL: REMOTE_URL } },
    );
    await expect(runMakeAdmin(['a@b.co'], deps)).resolves.toBe(1);
    expect(calls).toEqual(['loadEnvFile']);
    expect(err.join('\n')).toMatch(/production/);
    expect(setPlatformAdmin).not.toHaveBeenCalled();
    // The shell value wins over the file.
    expect(deps.env.DATABASE_URL).toBe(LOCAL_URL);
  });

  it('refuses a remote host without --remote before any DB access', async () => {
    const { deps, calls, err, setPlatformAdmin } = makeDeps({
      DATABASE_URL: REMOTE_URL,
    });
    await expect(runMakeAdmin(['a@b.co'], deps)).resolves.toBe(1);
    expect(setPlatformAdmin).not.toHaveBeenCalled();
    expect(calls).toEqual(['loadEnvFile']);
    expect(err.join('\n')).not.toMatch(/alice_db|secret/);
  });

  it('refuses in production before any DB access', async () => {
    const { deps, setPlatformAdmin } = makeDeps({
      DATABASE_URL: LOCAL_URL,
      NODE_ENV: 'production',
    });
    await expect(runMakeAdmin(['a@b.co'], deps)).resolves.toBe(1);
    expect(setPlatformAdmin).not.toHaveBeenCalled();
  });

  it('refuses a mismatched --remote host before any DB access', async () => {
    const { deps, setPlatformAdmin } = makeDeps({ DATABASE_URL: REMOTE_URL });
    await expect(
      runMakeAdmin(['a@b.co', '--remote=other.example.invalid'], deps),
    ).resolves.toBe(1);
    expect(setPlatformAdmin).not.toHaveBeenCalled();
  });

  it('honours PGHOST from the env file when the URL has no host', async () => {
    const { deps, setPlatformAdmin } = makeDeps(
      { DATABASE_URL: 'postgresql:///db' },
      { envFile: { PGHOST: 'db.example.invalid' } },
    );
    await expect(runMakeAdmin(['a@b.co'], deps)).resolves.toBe(1);
    expect(setPlatformAdmin).not.toHaveBeenCalled();
  });

  it('prints only the host for a matching --remote, then writes', async () => {
    const { deps, out, calls } = makeDeps({ DATABASE_URL: REMOTE_URL });
    await expect(
      runMakeAdmin(['a@b.co', '--remote=db.example.invalid'], deps),
    ).resolves.toBe(0);
    expect(calls).toEqual(['loadEnvFile', 'db:a@b.co:true']);
    expect(out[0]).toBe('Using remote database host: db.example.invalid');
    expect(out.join('\n')).not.toMatch(/alice_db|secret/);
  });

  it('sanitizes a DB error to a generic message, the host and the code', async () => {
    const { deps, err } = makeDeps(
      { DATABASE_URL: LOCAL_URL },
      {
        throws: Object.assign(
          new Error('password authentication failed for user "alice_db"'),
          { code: '28P01' },
        ),
      },
    );
    await expect(runMakeAdmin(['a@b.co'], deps)).resolves.toBe(1);
    const printed = err.join('\n');
    expect(printed).toContain('localhost');
    expect(printed).toContain('28P01');
    expect(printed).not.toContain('alice_db');
  });
});
