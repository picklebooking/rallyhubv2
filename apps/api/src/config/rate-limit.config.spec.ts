import {
  getAuthRateLimitOptions,
  getTenantAdminThrottlerOptions,
  getTrustProxyHops,
} from './rate-limit.config';

const ENV_NAMES = [
  'AUTH_RATE_LIMIT_MAX',
  'AUTH_RATE_LIMIT_WINDOW_SECONDS',
  'TENANT_ADMIN_RATE_LIMIT_MAX',
  'TENANT_ADMIN_RATE_LIMIT_TTL_MS',
  'TRUST_PROXY_HOPS',
];

describe('rate limit config', () => {
  const initialEnv = Object.fromEntries(
    ENV_NAMES.map((name) => [name, process.env[name]]),
  );

  beforeEach(() => {
    for (const name of ENV_NAMES) delete process.env[name];
  });

  afterEach(() => {
    for (const [name, value] of Object.entries(initialEnv)) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  });

  describe('getAuthRateLimitOptions', () => {
    it('is enabled in every environment and allows 5 sign-in and sign-up attempts a minute', () => {
      expect(getAuthRateLimitOptions()).toEqual({
        enabled: true,
        customRules: {
          '/sign-in/*': { window: 60, max: 5 },
          '/sign-up/*': { window: 60, max: 5 },
        },
      });
    });

    it('reads the attempt limit and window from the environment', () => {
      process.env.AUTH_RATE_LIMIT_MAX = '20';
      process.env.AUTH_RATE_LIMIT_WINDOW_SECONDS = '30';

      expect(getAuthRateLimitOptions().customRules).toEqual({
        '/sign-in/*': { window: 30, max: 20 },
        '/sign-up/*': { window: 30, max: 20 },
      });
    });

    it.each(['0', '-1', '1.5', 'abc'])(
      'falls back to the default when the limit is invalid: %s',
      (value) => {
        process.env.AUTH_RATE_LIMIT_MAX = value;

        expect(getAuthRateLimitOptions().customRules?.['/sign-in/*']).toEqual({
          window: 60,
          max: 5,
        });
      },
    );
  });

  describe('getTenantAdminThrottlerOptions', () => {
    it('allows 5 requests a minute and blocks for a minute after that', () => {
      expect(getTenantAdminThrottlerOptions()).toEqual({
        name: 'tenant-admin',
        limit: 5,
        ttl: 60_000,
        blockDuration: 60_000,
      });
    });

    it('reads the limit and window from the environment', () => {
      process.env.TENANT_ADMIN_RATE_LIMIT_MAX = '50';
      process.env.TENANT_ADMIN_RATE_LIMIT_TTL_MS = '1000';

      expect(getTenantAdminThrottlerOptions()).toMatchObject({
        limit: 50,
        ttl: 1000,
        blockDuration: 1000,
      });
    });
  });

  describe('getTrustProxyHops', () => {
    it('trusts one proxy hop by default', () => {
      expect(getTrustProxyHops()).toBe(1);
    });

    it.each([
      ['0', 0],
      ['2', 2],
    ])('reads TRUST_PROXY_HOPS=%s', (value, expected) => {
      process.env.TRUST_PROXY_HOPS = value;
      expect(getTrustProxyHops()).toBe(expected);
    });

    it.each(['-1', '1.5', 'true', ''])(
      'falls back to one hop for an invalid value: %s',
      (value) => {
        process.env.TRUST_PROXY_HOPS = value;
        expect(getTrustProxyHops()).toBe(1);
      },
    );
  });
});
