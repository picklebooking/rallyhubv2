import { jest } from '@jest/globals';
import type { INestApplication } from '@nestjs/common';
import type { Server } from 'node:http';
import request from 'supertest';
import { randomUUID } from 'node:crypto';
import { createHttpTestApp } from '../test-support/http-app';
import { HttpFixtures, teardownHttpSuite } from '../test-support/fixtures';

type SignUpBody = { user: { id: string } };
type SessionBody = { user: { id: string } };

const describeIfDb = process.env.TEST_DATABASE_URL ? describe : describe.skip;

describeIfDb('HTTP authorization harness (requires TEST_DATABASE_URL)', () => {
  let app: INestApplication;
  let fixtures: HttpFixtures;

  beforeAll(async () => {
    app = await createHttpTestApp();
    fixtures = new HttpFixtures();
  });

  afterAll(() => teardownHttpSuite(app, fixtures));

  it('rejects an unauthenticated current-user request', async () => {
    await request(app.getHttpServer()).get('/users/me').expect(401);
  });

  it('accepts a real Better Auth session and returns the matching user', async () => {
    const actor = await fixtures.signUp(app);
    const response = await request(app.getHttpServer())
      .get('/users/me')
      .set('Cookie', actor.cookie)
      .expect(200);
    expect(response.body).toMatchObject({
      id: actor.userId,
      email: actor.email,
    });
    expect(response.body).not.toHaveProperty('isPlatformAdmin');
  });

  it('ignores a platform-admin flag supplied during signup and keeps it private', async () => {
    const email = `harness-${randomUUID()}@example.com`;
    const response = await request(app.getHttpServer())
      .post('/api/auth/sign-up/email')
      .set('Origin', 'http://localhost:3000')
      .send({
        email,
        password: 'Harness-password-123!',
        name: 'Harness user',
        isPlatformAdmin: true,
      })
      .expect(200);
    const signUpBody = response.body as SignUpBody;
    const userId = signUpBody.user.id;
    fixtures.trackUser(userId);
    expect(signUpBody.user).not.toHaveProperty('isPlatformAdmin');
    expect(await fixtures.getPlatformAdmin(userId)).toBe(false);
    const cookie = (response.headers['set-cookie'] as unknown as string[])
      .map((value) => value.split(';')[0])
      .join('; ');
    const session = await request(app.getHttpServer())
      .get('/api/auth/get-session')
      .set('Cookie', cookie)
      .expect(200);
    const sessionBody = session.body as SessionBody;
    expect(sessionBody.user.id).toBe(userId);
    expect(sessionBody.user).not.toHaveProperty('isPlatformAdmin');
    const currentUser = await request(app.getHttpServer())
      .get('/users/me')
      .set('Cookie', cookie)
      .expect(200);
    expect(currentUser.body).not.toHaveProperty('isPlatformAdmin');
  });

  it("raises Better Auth's password-reset limit for shared suites", async () => {
    const errorSpy = jest
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    try {
      const statuses: number[] = [];
      for (let attempt = 0; attempt < 4; attempt += 1) {
        const response = await request(app.getHttpServer() as Server)
          .post('/api/auth/request-password-reset')
          .set('Origin', 'http://localhost:3000')
          .send({ email: `harness-${randomUUID()}@example.com` });
        statuses.push(response.status);
      }
      expect(statuses).not.toContain(429);
    } finally {
      errorSpy.mockRestore();
    }
  });
});
