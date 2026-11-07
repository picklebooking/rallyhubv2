import type { INestApplication } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import request from 'supertest';

export type HttpTestSession = { userId: string; email: string; cookie: string };

export async function signUpAndSignIn(
  app: INestApplication,
  opts: { email?: string; name?: string } = {},
): Promise<HttpTestSession> {
  const email = opts.email ?? `harness-${randomUUID()}@example.com`;
  const password = 'Harness-password-123!';
  const signup = await request(app.getHttpServer())
    .post('/api/auth/sign-up/email')
    .set('Origin', 'http://localhost:3000')
    .send({ email, password, name: opts.name ?? 'Harness user' })
    .expect(200);
  let cookies = signup.headers['set-cookie'] as unknown as string[] | undefined;
  if (!cookies?.length) {
    const signin = await request(app.getHttpServer())
      .post('/api/auth/sign-in/email')
      .set('Origin', 'http://localhost:3000')
      .send({ email, password })
      .expect(200);
    cookies = signin.headers['set-cookie'] as unknown as string[] | undefined;
  }
  if (!cookies?.length)
    throw new Error('Better Auth did not issue a session cookie');
  return {
    userId: signup.body.user.id as string,
    email,
    cookie: cookies.map((cookie) => cookie.split(';')[0]).join('; '),
  };
}
