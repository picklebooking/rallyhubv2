import { getSlugValidationError, isValidSlug } from './venue-slug.utils';

describe('isValidSlug', () => {
  it('accepts a valid simple slug', () => {
    expect(isValidSlug('austin-club')).toBe(true);
  });

  it('accepts a slug with only lowercase letters', () => {
    expect(isValidSlug('mytenant')).toBe(true);
  });

  it('accepts a slug with numbers', () => {
    expect(isValidSlug('tenant123')).toBe(true);
  });

  it('accepts a slug at minimum length (3 chars)', () => {
    expect(isValidSlug('abc')).toBe(true);
  });

  it('accepts a slug at maximum length (63 chars)', () => {
    const slug = 'a'.repeat(63);
    expect(isValidSlug(slug)).toBe(true);
  });

  it('rejects a slug shorter than 3 characters', () => {
    expect(isValidSlug('ab')).toBe(false);
  });

  it('rejects a slug longer than 63 characters', () => {
    const slug = 'a'.repeat(64);
    expect(isValidSlug(slug)).toBe(false);
  });

  it('rejects a slug with uppercase letters', () => {
    expect(isValidSlug('Austin-Club')).toBe(false);
  });

  it('rejects a slug with spaces', () => {
    expect(isValidSlug('austin club')).toBe(false);
  });

  it('rejects a slug with underscores', () => {
    expect(isValidSlug('austin_club')).toBe(false);
  });

  it('rejects a slug starting with a hyphen', () => {
    expect(isValidSlug('-austin')).toBe(false);
  });

  it('rejects a slug ending with a hyphen', () => {
    expect(isValidSlug('austin-')).toBe(false);
  });

  it('rejects a slug with consecutive hyphens', () => {
    expect(isValidSlug('austin--club')).toBe(false);
  });

  it('rejects reserved slugs', () => {
    expect(isValidSlug('www')).toBe(false);
    expect(isValidSlug('app')).toBe(false);
    expect(isValidSlug('api')).toBe(false);
    expect(isValidSlug('admin')).toBe(false);
    expect(isValidSlug('mail')).toBe(false);
    expect(isValidSlug('staging')).toBe(false);
  });

  it('rejects an empty string', () => {
    expect(isValidSlug('')).toBe(false);
  });

  it('rejects a slug with special characters', () => {
    expect(isValidSlug('austin@club')).toBe(false);
    expect(isValidSlug('austin.club')).toBe(false);
    expect(isValidSlug('austin/club')).toBe(false);
  });
});

describe('getSlugValidationError', () => {
  it('returns null for a valid slug', () => {
    expect(getSlugValidationError('austin-club')).toBeNull();
  });

  it('returns length error for a short slug', () => {
    const error = getSlugValidationError('ab');
    expect(error).toContain('at least 3 characters');
  });

  it('returns length error for a long slug', () => {
    const error = getSlugValidationError('a'.repeat(64));
    expect(error).toContain('at most 63 characters');
  });

  it('returns format error for invalid characters', () => {
    const error = getSlugValidationError('Austin-Club');
    expect(error).toContain('lowercase letters');
  });

  it('returns consecutive hyphen error', () => {
    const error = getSlugValidationError('austin--club');
    expect(error).toContain('consecutive hyphens');
  });

  it('returns reserved name error', () => {
    const error = getSlugValidationError('www');
    expect(error).toContain('reserved name');
  });
});
