import type { PrismaClient } from '../generated/prisma/client';
import { createAuth, getGoogleProviderConfig } from './auth';

describe('getGoogleProviderConfig', () => {
  const initialClientId = process.env.GOOGLE_CLIENT_ID;
  const initialClientSecret = process.env.GOOGLE_CLIENT_SECRET;

  afterEach(() => {
    if (initialClientId === undefined) {
      delete process.env.GOOGLE_CLIENT_ID;
    } else {
      process.env.GOOGLE_CLIENT_ID = initialClientId;
    }

    if (initialClientSecret === undefined) {
      delete process.env.GOOGLE_CLIENT_SECRET;
    } else {
      process.env.GOOGLE_CLIENT_SECRET = initialClientSecret;
    }
  });

  it('throws when Google OAuth is not configured', () => {
    delete process.env.GOOGLE_CLIENT_ID;
    delete process.env.GOOGLE_CLIENT_SECRET;

    expect(() => getGoogleProviderConfig()).toThrow(
      'GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET are required',
    );
  });

  it('rejects a partial Google credential pair', () => {
    process.env.GOOGLE_CLIENT_ID = 'google-client-id';
    delete process.env.GOOGLE_CLIENT_SECRET;

    expect(() => getGoogleProviderConfig()).toThrow(
      'GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET are required',
    );
  });

  it('returns the provider credentials when both values are configured', () => {
    process.env.GOOGLE_CLIENT_ID = 'google-client-id';
    process.env.GOOGLE_CLIENT_SECRET = 'google-client-secret';

    expect(getGoogleProviderConfig()).toEqual({
      clientId: 'google-client-id',
      clientSecret: 'google-client-secret',
    });
  });
});

describe('createAuth rate limiting', () => {
  const managedEnv = [
    'BETTER_AUTH_SECRET',
    'GOOGLE_CLIENT_ID',
    'GOOGLE_CLIENT_SECRET',
    'AUTH_IP_ADDRESS_HEADER',
  ];
  const initialEnv = Object.fromEntries(
    managedEnv.map((name) => [name, process.env[name]]),
  );

  beforeEach(() => {
    process.env.BETTER_AUTH_SECRET =
      'auth-spec-test-only-secret-at-least-32-characters';
    process.env.GOOGLE_CLIENT_ID = 'google-client-id';
    process.env.GOOGLE_CLIENT_SECRET = 'google-client-secret';
    delete process.env.AUTH_IP_ADDRESS_HEADER;
  });

  afterEach(() => {
    for (const [name, value] of Object.entries(initialEnv)) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  });

  function build(): ReturnType<typeof createAuth> {
    return createAuth({} as PrismaClient);
  }

  it('turns the limiter on with the sign-in and sign-up rules', () => {
    const { rateLimit } = build().options;

    expect(rateLimit?.enabled).toBe(true);
    expect(rateLimit?.customRules?.['/sign-in/*']).toEqual({
      window: 60,
      max: 5,
    });
  });

  it('reads the client IP from the configured header', () => {
    process.env.AUTH_IP_ADDRESS_HEADER = 'x-real-ip';

    expect(build().options.advanced?.ipAddress?.ipAddressHeaders).toEqual([
      'x-real-ip',
    ]);
  });
});
