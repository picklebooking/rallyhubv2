import { TenantRole } from '../generated/prisma/enums';

export type MembershipState = {
  role: TenantRole;
  venueId: string | null;
  isActive: boolean;
};

export function isActiveTenantWideOwner(member: MembershipState): boolean {
  return (
    member.role === TenantRole.OWNER &&
    member.venueId === null &&
    member.isActive
  );
}

export function isValidRoleScope(
  role: TenantRole,
  venueId: string | null,
): boolean {
  return role !== TenantRole.OWNER || venueId === null;
}

export function wouldRemoveLastOwner(
  target: MembershipState,
  next: MembershipState,
  otherActiveOwnerCount: number,
): boolean {
  return (
    isActiveTenantWideOwner(target) &&
    !isActiveTenantWideOwner(next) &&
    otherActiveOwnerCount === 0
  );
}

export type FirstOwnerClaim = {
  actorEmail: string;
  actorEmailVerified: boolean;
  requestEmail: string;
  requestRole: TenantRole;
  requestVenueId: string | null;
  tenantEmail: string | null;
  tenantHasAnyMember: boolean;
};

export function isValidFirstOwnerClaim(claim: FirstOwnerClaim): boolean {
  return (
    claim.requestRole === TenantRole.OWNER &&
    claim.requestVenueId === null &&
    claim.actorEmailVerified &&
    claim.requestEmail.toLowerCase() === claim.actorEmail.toLowerCase() &&
    claim.tenantEmail !== null &&
    claim.tenantEmail.toLowerCase() === claim.actorEmail.toLowerCase() &&
    !claim.tenantHasAnyMember
  );
}
