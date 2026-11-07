import { jest } from '@jest/globals';
import { createServer, type Server } from 'node:http';
import type { INestApplication } from '@nestjs/common';
import { signUpAndSignIn } from './auth-session';
import { teardownHttpSuite, type HttpFixtures } from './fixtures';

describe('HTTP harness teardown safety', () => {
  let server: Server;

  afterEach(async () => {
    if (server?.listening) {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  it('reports the created user before a failing sign-in fallback throws', async () => {
    // Sign-up succeeds without a cookie, then the sign-in fallback fails.
    server = createServer((req, res) => {
      res.setHeader('Content-Type', 'application/json');
      if (req.url === '/api/auth/sign-up/email') {
        res.statusCode = 200;
        res.end(JSON.stringify({ user: { id: 'created-user-id' } }));
      } else {
        res.statusCode = 500;
        res.end('{}');
      }
    });
    const app = { getHttpServer: () => server } as unknown as INestApplication;
    const created: string[] = [];

    await expect(
      signUpAndSignIn(app, { onUserCreated: (id) => created.push(id) }),
    ).rejects.toThrow();
    expect(created).toEqual(['created-user-id']);
  });

  it('closes the app even when fixture cleanup fails, then rethrows', async () => {
    const close = jest.fn(() => Promise.resolve());
    const app = { close } as unknown as INestApplication;
    const fixtures = {
      cleanup: jest.fn(() => Promise.reject(new Error('cleanup failed'))),
    } as unknown as HttpFixtures;

    await expect(teardownHttpSuite(app, fixtures)).rejects.toThrow(
      'cleanup failed',
    );
    expect(close).toHaveBeenCalledTimes(1);
  });

  it('tolerates a suite whose setup failed before app or fixtures existed', async () => {
    await expect(
      teardownHttpSuite(undefined, undefined),
    ).resolves.toBeUndefined();
  });
});
