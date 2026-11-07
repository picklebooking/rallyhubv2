import { TenantRole } from '../generated/prisma/enums';
import {
  isActiveTenantWideOwner,
  isValidFirstOwnerClaim,
  isValidRoleScope,
  wouldRemoveLastOwner,
  type FirstOwnerClaim,
  type MembershipState,
} from './tenant-member.rules';

const owner: MembershipState = {
  role: TenantRole.OWNER,
  venueId: null,
  isActive: true,
};

const validClaim: FirstOwnerClaim = {
  actorEmail: 'contact@example.com',
  actorEmailVerified: true,
  requestEmail: 'contact@example.com',
  requestRole: TenantRole.OWNER,
  requestVenueId: null,
  tenantEmail: 'contact@example.com',
  tenantHasAnyMember: false,
};

describe('membership rules', () => {
  describe('wouldRemoveLastOwner', () => {
    const mutations: [string, MembershipState][] = [
      ['delete', { ...owner, isActive: false }],
      ['demote', { ...owner, role: TenantRole.STAFF }],
      ['demote with venue', { ...owner, role: TenantRole.STAFF, venueId: 'v' }],
    ];

    it.each(mutations)('blocks sole-owner %s', (_name, next) => {
      expect(wouldRemoveLastOwner(owner, next, 0)).toBe(true);
    });

    it.each(mutations)(
      'allows %s when another owner remains',
      (_name, next) => {
        expect(wouldRemoveLastOwner(owner, next, 1)).toBe(false);
      },
    );

    it('allows a sole-owner no-op', () => {
      expect(wouldRemoveLastOwner(owner, { ...owner }, 0)).toBe(false);
    });

    it('does not protect a STAFF target as an owner', () => {
      expect(
        wouldRemoveLastOwner(
          { ...owner, role: TenantRole.STAFF },
          { ...owner, role: TenantRole.STAFF, isActive: false },
          0,
        ),
      ).toBe(false);
    });

    it('does not protect an inactive OWNER target as an active owner', () => {
      expect(
        wouldRemoveLastOwner(
          { ...owner, isActive: false },
          { ...owner, role: TenantRole.STAFF, isActive: false },
          0,
        ),
      ).toBe(false);
    });
  });

  describe('isActiveTenantWideOwner', () => {
    it('recognizes an active tenant-wide OWNER', () => {
      expect(isActiveTenantWideOwner(owner)).toBe(true);
    });

    it.each<MembershipState>([
      { ...owner, venueId: 'v' },
      { ...owner, venueId: '' },
      { ...owner, isActive: false },
      { ...owner, role: TenantRole.STAFF },
    ])('rejects a non-owner state %o', (member) => {
      expect(isActiveTenantWideOwner(member)).toBe(false);
    });
  });

  describe('isValidRoleScope', () => {
    it.each<[TenantRole, string | null, boolean]>([
      [TenantRole.OWNER, 'v', false],
      [TenantRole.OWNER, '', false],
      [TenantRole.OWNER, null, true],
      [TenantRole.STAFF, 'v', true],
      [TenantRole.STAFF, null, true],
    ])('validates %s at scope %s as %s', (role, venueId, expected) => {
      expect(isValidRoleScope(role, venueId)).toBe(expected);
    });
  });

  describe('isValidFirstOwnerClaim', () => {
    it('accepts a verified contact claiming an empty tenant as OWNER', () => {
      expect(isValidFirstOwnerClaim(validClaim)).toBe(true);
    });

    it('compares all three emails case-insensitively', () => {
      expect(
        isValidFirstOwnerClaim({
          ...validClaim,
          actorEmail: 'Contact@Example.com',
          requestEmail: 'CONTACT@example.COM',
          tenantEmail: 'contact@EXAMPLE.com',
        }),
      ).toBe(true);
    });

    it.each<[string, Partial<FirstOwnerClaim>]>([
      ['unverified actor', { actorEmailVerified: false }],
      ['STAFF role', { requestRole: TenantRole.STAFF }],
      ['venue scope', { requestVenueId: 'v' }],
      ['empty-string venue scope', { requestVenueId: '' }],
      ['request email mismatch', { requestEmail: 'other@example.com' }],
      ['missing tenant email', { tenantEmail: null }],
      ['tenant email mismatch', { tenantEmail: 'other@example.com' }],
      ['existing membership', { tenantHasAnyMember: true }],
      ['request email whitespace', { requestEmail: ' contact@example.com' }],
      ['actor email whitespace', { actorEmail: ' contact@example.com' }],
      ['tenant email whitespace', { tenantEmail: 'contact@example.com ' }],
    ])('rejects %s', (_name, changes) => {
      expect(isValidFirstOwnerClaim({ ...validClaim, ...changes })).toBe(false);
    });
  });
});
