import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createHttpTestApp } from '../test-support/http-app';
import type { HttpTestSession } from '../test-support/auth-session';
import { HttpFixtures, teardownHttpSuite } from '../test-support/fixtures';

const describeIfDb = process.env.TEST_DATABASE_URL ? describe : describe.skip;

describeIfDb(
  'Users HTTP directory removal (requires TEST_DATABASE_URL)',
  () => {
    let app: INestApplication;
    let fixtures: HttpFixtures;
    let actor: HttpTestSession;

    beforeAll(async () => {
      app = await createHttpTestApp();
      fixtures = new HttpFixtures();
      actor = await fixtures.signUp(app);
    });

    afterAll(() => teardownHttpSuite(app, fixtures));

    it('returns 404 for the removed directory even with a valid session', async () => {
      await request(app.getHttpServer())
        .get('/users/all')
        .set('Cookie', actor.cookie)
        .expect(404);
    });

    it('preserves the current user response and excludes internal admin flags', async () => {
      await fixtures.makePlatformAdmin(actor.userId);

      const response = await request(app.getHttpServer())
        .get('/users/me')
        .set('Cookie', actor.cookie)
        .expect(200);

      expect(response.body).toEqual({
        id: actor.userId,
        email: actor.email,
        name: 'Harness user',
        imageUrl: null,
      });
      expect(await fixtures.getPlatformAdmin(actor.userId)).toBe(true);
    });
  },
);
