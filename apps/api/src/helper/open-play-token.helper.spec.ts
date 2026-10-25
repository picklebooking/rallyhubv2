import { OpenPlayTokenHelper } from './open-play-token.helper';

describe('OpenPlayTokenHelper', () => {
  const helper = new OpenPlayTokenHelper();

  it('generates a 32-char URL-safe token', () => {
    const token = helper.generate();
    expect(token).toHaveLength(32);
    expect(token).toMatch(/^[A-Za-z0-9_-]{32}$/);
  });

  it('generates a different token each call', () => {
    expect(helper.generate()).not.toBe(helper.generate());
  });
});
