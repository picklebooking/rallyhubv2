import { jest } from '@jest/globals';
import { ForbiddenException } from '@nestjs/common';
import { ErrorConstant } from '../constants/error-code.constant';
import { AuthorizationRepository } from './authorization.repository';
import { AuthorizationService } from './authorization.service';

describe('AuthorizationService', () => {
  let repository: jest.Mocked<AuthorizationRepository>;
  let service: AuthorizationService;

  beforeEach(() => {
    repository = {
      isPlatformAdmin: jest
        .fn<AuthorizationRepository['isPlatformAdmin']>()
        .mockResolvedValue(false),
      hasTenantOwnerMembership: jest
        .fn<AuthorizationRepository['hasTenantOwnerMembership']>()
        .mockResolvedValue(false),
      hasTenantWideMembership: jest
        .fn<AuthorizationRepository['hasTenantWideMembership']>()
        .mockResolvedValue(false),
      hasVenueManagerMembership: jest
        .fn<AuthorizationRepository['hasVenueManagerMembership']>()
        .mockResolvedValue(false),
    } as unknown as jest.Mocked<AuthorizationRepository>;
    service = new AuthorizationService(repository);
  });

  it('lets platform admins pass every policy without membership queries', async () => {
    repository.isPlatformAdmin.mockResolvedValue(true);
    await service.assertPlatformAdmin('admin');
    await service.assertCanEditTenant('admin', 'tenant');
    await service.assertCanCreateVenue('admin', 'tenant');
    await service.assertCanManageVenue('admin', 'tenant', 'venue');
    expect(repository.isPlatformAdmin.mock.calls).toEqual(
      Array(4).fill(['admin']),
    );
    expect(repository.hasTenantOwnerMembership).not.toHaveBeenCalled();
    expect(repository.hasTenantWideMembership).not.toHaveBeenCalled();
    expect(repository.hasVenueManagerMembership).not.toHaveBeenCalled();
  });

  async function expectForbidden(action: Promise<void>): Promise<void> {
    await expect(action).rejects.toMatchObject({
      status: 403,
      message: ErrorConstant.AUTHORIZATION_MESSAGES.FORBIDDEN,
    });
  }

  it('rejects non-admin platform access with the shared 403 message', async () => {
    await expectForbidden(service.assertPlatformAdmin('user'));
    await expect(service.assertPlatformAdmin('user')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('allows tenant owners to edit', async () => {
    repository.hasTenantOwnerMembership.mockResolvedValue(true);
    await expect(
      service.assertCanEditTenant('owner', 'tenant'),
    ).resolves.toBeUndefined();
    expect(repository.hasTenantOwnerMembership).toHaveBeenCalledWith(
      'owner',
      'tenant',
    );
  });

  it('rejects tenant-wide staff editing a tenant', async () => {
    repository.hasTenantWideMembership.mockResolvedValue(true);
    await expectForbidden(service.assertCanEditTenant('staff', 'tenant'));
    expect(repository.hasTenantWideMembership).not.toHaveBeenCalled();
  });

  it('allows tenant-wide staff to create venues', async () => {
    repository.hasTenantWideMembership.mockResolvedValue(true);
    await expect(
      service.assertCanCreateVenue('staff', 'tenant'),
    ).resolves.toBeUndefined();
    expect(repository.hasTenantWideMembership).toHaveBeenCalledWith(
      'staff',
      'tenant',
    );
  });

  it('rejects venue-scoped staff creating a venue', async () => {
    repository.hasVenueManagerMembership.mockResolvedValue(true);
    await expectForbidden(service.assertCanCreateVenue('staff', 'tenant'));
    expect(repository.hasVenueManagerMembership).not.toHaveBeenCalled();
  });

  it('allows staff to manage their venue', async () => {
    repository.hasVenueManagerMembership.mockResolvedValue(true);
    await expect(
      service.assertCanManageVenue('staff', 'tenant', 'own'),
    ).resolves.toBeUndefined();
    expect(repository.hasVenueManagerMembership).toHaveBeenCalledWith(
      'staff',
      'tenant',
      'own',
    );
  });

  it('rejects staff managing a different venue', async () => {
    await expectForbidden(
      service.assertCanManageVenue('staff', 'tenant', 'other'),
    );
    expect(repository.hasVenueManagerMembership).toHaveBeenCalledWith(
      'staff',
      'tenant',
      'other',
    );
  });
});
