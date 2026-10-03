/**
 * Slug validation for tenant subdomains.
 *
 * A valid slug:
 * - 3-63 characters long
 * - Lowercase alphanumeric + hyphens only
 * - Starts and ends with an alphanumeric character
 * - No consecutive hyphens
 * - Not a reserved subdomain
 */

const SLUG_PATTERN = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/;

const RESERVED_SLUGS = new Set([
  'www',
  'app',
  'api',
  'admin',
  'mail',
  'smtp',
  'ftp',
  'cdn',
  'assets',
  'static',
  'docs',
  'help',
  'support',
  'billing',
  'status',
  'blog',
  'staging',
  'dev',
  'test',
  'demo',
  'sandbox',
]);

const MIN_SLUG_LENGTH = 3;
const MAX_SLUG_LENGTH = 63;

/**
 * Checks whether a slug meets every validation rule documented above.
 *
 * @param   {string}  slug The slug to validate.
 * @returns {boolean}      `true` if the slug is valid.
 */
export function isValidSlug(slug: string): boolean {
  if (slug.length < MIN_SLUG_LENGTH || slug.length > MAX_SLUG_LENGTH) {
    return false;
  }

  if (!SLUG_PATTERN.test(slug)) {
    return false;
  }

  if (slug.includes('--')) {
    return false;
  }

  if (RESERVED_SLUGS.has(slug)) {
    return false;
  }

  return true;
}

/**
 * Validates a slug and describes the first rule it violates.
 *
 * @param   {string}         slug The slug to validate.
 * @returns {string | null}       A human-readable error, or `null` if valid.
 */
export function getSlugValidationError(slug: string): string | null {
  if (slug.length < MIN_SLUG_LENGTH) {
    return `Slug must be at least ${MIN_SLUG_LENGTH} characters long`;
  }

  if (slug.length > MAX_SLUG_LENGTH) {
    return `Slug must be at most ${MAX_SLUG_LENGTH} characters long`;
  }

  if (!SLUG_PATTERN.test(slug)) {
    return 'Slug must contain only lowercase letters, numbers, and hyphens, and must start and end with a letter or number';
  }

  if (slug.includes('--')) {
    return 'Slug must not contain consecutive hyphens';
  }

  if (RESERVED_SLUGS.has(slug)) {
    return `"${slug}" is a reserved name and cannot be used as a tenant slug`;
  }

  return null;
}
