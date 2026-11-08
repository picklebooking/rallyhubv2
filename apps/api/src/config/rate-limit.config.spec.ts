import { getAuthRateLimitOptions } from './rate-limit.config';

const ENV_NAMES = ['AUTH_RATE_LIMIT_MAX', 'AUTH_RATE_LIMIT_WINDOW_SECONDS'];

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
});
