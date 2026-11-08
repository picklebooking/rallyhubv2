import { jest } from '@jest/globals';
import type { INestApplication } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { Server } from 'node:http';
import request from 'supertest';
import { createHttpTestApp } from '../test-support/http-app';
import { HttpFixtures, teardownHttpSuite } from '../test-support/fixtures';

const describeIfDb = process.env.TEST_DATABASE_URL ? describe : describe.skip;
const ORIGIN = 'http://localhost:3000';
const PASSWORD = 'Rate-limit-password-123!';

let ipCounter = 0;
/** A fresh client address per test keeps the per-IP buckets independent. */
function nextClientIp(): string {
  ipCounter += 1;
  return `203.0.113.${ipCounter}`;
}

type SignUpBody = { user?: { id: string } };

describeIfDb('Rate limits (requires TEST_DATABASE_URL)', () => {
  let app: INestApplication;
  let fixtures: HttpFixtures;

  beforeAll(async () => {
    // Failed sign-ins and the unconfigured password reset make Better Auth log
    // on every attempt; keep the output clean.
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    app = await createHttpTestApp(undefined, { realRateLimits: true });
    fixtures = new HttpFixtures();
  });

  function agent(): ReturnType<typeof request> {
    return request(app.getHttpServer() as Server);
  }

  afterAll(async () => {
    await teardownHttpSuite(app, fixtures);
    jest.restoreAllMocks();
  });

  function signIn(clientIp: string, email: string): request.Test {
    return agent()
      .post('/api/auth/sign-in/email')
      .set('Origin', ORIGIN)
      .set('X-Forwarded-For', clientIp)
      .send({ email, password: 'wrong-password-123!' });
  }

  async function signUp(clientIp: string): Promise<number> {
    const response = await agent()
      .post('/api/auth/sign-up/email')
      .set('Origin', ORIGIN)
      .set('X-Forwarded-For', clientIp)
      .send({
        email: `rate-limit-${randomUUID()}@example.com`,
        password: PASSWORD,
        name: 'Rate limit user',
      });
    const userId = (response.body as SignUpBody).user?.id;
    if (userId) fixtures.trackUser(userId);
    return response.status;
  }

  describe('POST /api/auth/sign-in/email', () => {
    it('rejects the 6th attempt within a minute from the same client with 429', async () => {
      const clientIp = nextClientIp();
      const email = `missing-${randomUUID()}@example.com`;
      const statuses: number[] = [];
      for (let attempt = 0; attempt < 6; attempt += 1) {
        statuses.push((await signIn(clientIp, email)).status);
      }
      expect(statuses.slice(0, 5)).not.toContain(429);
      expect(statuses[5]).toBe(429);
    });

    it('does not block a different client address', async () => {
      const blockedIp = nextClientIp();
      const email = `missing-${randomUUID()}@example.com`;
      for (let attempt = 0; attempt < 6; attempt += 1) {
        await signIn(blockedIp, email);
      }
      expect((await signIn(blockedIp, email)).status).toBe(429);
      expect((await signIn(nextClientIp(), email)).status).not.toBe(429);
    });
  });

  describe('POST /api/auth/sign-up/email', () => {
    it('rejects the 6th sign-up within a minute from the same client with 429', async () => {
      const clientIp = nextClientIp();
      const statuses: number[] = [];
      for (let attempt = 0; attempt < 6; attempt += 1) {
        statuses.push(await signUp(clientIp));
      }
      expect(statuses.slice(0, 5)).toEqual([200, 200, 200, 200, 200]);
      expect(statuses[5]).toBe(429);
    });
  });

  describe('Better Auth default rules', () => {
    it('still limits password reset requests to 3 a minute', async () => {
      const clientIp = nextClientIp();
      const statuses: number[] = [];
      for (let attempt = 0; attempt < 4; attempt += 1) {
        const response = await agent()
          .post('/api/auth/request-password-reset')
          .set('Origin', ORIGIN)
          .set('X-Forwarded-For', clientIp)
          .send({ email: `missing-${randomUUID()}@example.com` });
        statuses.push(response.status);
      }
      expect(statuses.slice(0, 3)).not.toContain(429);
      expect(statuses[3]).toBe(429);
    });
  });
});
