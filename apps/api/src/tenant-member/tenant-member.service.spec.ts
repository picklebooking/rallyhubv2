import { jest } from '@jest/globals';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AuthorizationRepository } from '../authorization/authorization.repository';
import { TenantRole } from '../generated/prisma/enums';
import type { ITenantGeneric } from '../interface/ITenantMember.interface';
import { ErrorConstant } from '../constants/error-code.constant';
import type {
  LockedMembershipStore,
  TenantLockOutcome,
} from './tenant-member.repository';
import { TenantMemberRepository } from './tenant-member.repository';
import { TenantMemberService } from './tenant-member.service';

describe('TenantMemberService', () => {
  const tenantId = 'tenant-1';
  const actor = {
    id: 'owner-1',
    email: 'owner@example.com',
    emailVerified: true,
  };
  const member: ITenantGeneric = {
    id: 'member-1',
    userId: 'target-1',
    tenantId,
    venueId: 'venue-1',
    role: TenantRole.STAFF,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  const dto = {
    email: 'target@example.com',
    role: TenantRole.STAFF,
    venueId: 'venue-1',
  };
  const store = {
    isActiveOwner: jest.fn<LockedMembershipStore['isActiveOwner']>(),
    hasAnyMember: jest.fn<LockedMembershipStore['hasAnyMember']>(),
    findTenantEmail: jest.fn<LockedMembershipStore['findTenantEmail']>(),
    findUserIdByEmail: jest.fn<LockedMembershipStore['findUserIdByEmail']>(),
    venueBelongsToTenant:
      jest.fn<LockedMembershipStore['venueBelongsToTenant']>(),
    findSameScope: jest.fn<LockedMembershipStore['findSameScope']>(),
    insert: jest.fn<LockedMembershipStore['insert']>(),
    reactivate: jest.fn<LockedMembershipStore['reactivate']>(),
    findActive: jest.fn<LockedMembershipStore['findActive']>(),
    countActiveOwnersExcept:
      jest.fn<LockedMembershipStore['countActiveOwnersExcept']>(),
    update: jest.fn<LockedMembershipStore['update']>(),
    softDelete: jest.fn<LockedMembershipStore['softDelete']>(),
  };
  const repo = {
    hasActiveOwner: jest.fn<TenantMemberRepository['hasActiveOwner']>(),
    withTenantLock: jest.fn<TenantMemberRepository['withTenantLock']>(),
    findAllActive: jest.fn<TenantMemberRepository['findAllActive']>(),
    findActive: jest.fn<TenantMemberRepository['findActive']>(),
  };
  const authorization = {
    isPlatformAdmin: jest.fn<AuthorizationRepository['isPlatformAdmin']>(),
  };
  let service: TenantMemberService;

  beforeEach(async () => {
    authorization.isPlatformAdmin.mockReset().mockResolvedValue(false);
    Object.values(repo).forEach((mock) => mock.mockReset());
    Object.values(store).forEach((mock) => mock.mockReset());
    repo.withTenantLock.mockImplementation(
      async <T>(
        _tenantId: string,
        work: (locked: LockedMembershipStore) => Promise<T>,
      ): Promise<TenantLockOutcome<T>> => ({
        kind: 'DONE',
        value: await work(store),
      }),
    );
    store.isActiveOwner.mockResolvedValue(true);
    store.hasAnyMember.mockResolvedValue(false);
    store.findTenantEmail.mockResolvedValue(actor.email);
    store.findUserIdByEmail.mockResolvedValue('target-1');
    store.findSameScope.mockResolvedValue(null);
    store.venueBelongsToTenant.mockResolvedValue(true);
    store.insert.mockResolvedValue(member);
    store.reactivate.mockResolvedValue(member);
    repo.hasActiveOwner.mockResolvedValue(true);
    store.countActiveOwnersExcept.mockResolvedValue(0);
    store.findActive.mockResolvedValue(member);
    repo.findActive.mockResolvedValue(member);
    store.update.mockResolvedValue(member);
    store.softDelete.mockResolvedValue({ ...member, isActive: false });
    const module = await Test.createTestingModule({
      providers: [
        TenantMemberService,
        { provide: TenantMemberRepository, useValue: repo },
        { provide: AuthorizationRepository, useValue: authorization },
      ],
    }).compile();
    service = module.get(TenantMemberService);
  });

  it('rejects every operation when the actor is neither an active owner nor a platform admin', async () => {
    repo.hasActiveOwner.mockResolvedValue(false);
    store.isActiveOwner.mockResolvedValue(false);
    await expect(service.create(tenantId, actor, dto)).rejects.toThrow(
      ForbiddenException,
    );
    await expect(service.findAll(tenantId, actor)).rejects.toThrow(
      ForbiddenException,
    );
    await expect(service.findOne(tenantId, member.id, actor)).rejects.toThrow(
      ForbiddenException,
    );
    await expect(
      service.update(member.id, tenantId, actor, { role: TenantRole.STAFF }),
    ).rejects.toThrow(ForbiddenException);
    await expect(service.remove(member.id, tenantId, actor)).rejects.toThrow(
      ForbiddenException,
    );
    expect(store.insert).not.toHaveBeenCalled();
    expect(repo.findAllActive).not.toHaveBeenCalled();
    expect(store.update).not.toHaveBeenCalled();
    expect(store.softDelete).not.toHaveBeenCalled();
  });

  describe('platform admin', () => {
    beforeEach(() => {
      authorization.isPlatformAdmin.mockResolvedValue(true);
      repo.hasActiveOwner.mockResolvedValue(false);
      store.isActiveOwner.mockResolvedValue(false);
      repo.findAllActive.mockResolvedValue([member]);
    });

    it('allows all five operations without a tenant membership', async () => {
      expect((await service.findAll(tenantId, actor)).content).toEqual([
        member,
      ]);
      expect(
        (await service.findOne(tenantId, member.id, actor)).content,
      ).toEqual(member);
      await service.create(tenantId, actor, dto);
      await service.update(member.id, tenantId, actor, {});
      await service.remove(member.id, tenantId, actor);
      expect(store.insert).toHaveBeenCalled();
      expect(store.update).toHaveBeenCalled();
      expect(store.softDelete).toHaveBeenCalled();
      expect(authorization.isPlatformAdmin).toHaveBeenCalledTimes(5);
      for (const call of authorization.isPlatformAdmin.mock.calls) {
        expect(call).toEqual([actor.id]);
      }
      expect(store.findTenantEmail).not.toHaveBeenCalled();
      expect(store.hasAnyMember).not.toHaveBeenCalled();
    });

    it('cannot remove or demote the sole owner', async () => {
      store.findActive.mockResolvedValue({
        ...member,
        role: TenantRole.OWNER,
        venueId: null,
      });
      await expect(
        service.remove(member.id, tenantId, actor),
      ).rejects.toMatchObject({
        status: 409,
        message: ErrorConstant.TENANT_MEMBER_MESSAGES.LAST_OWNER,
      });
      await expect(
        service.update(member.id, tenantId, actor, { role: TenantRole.STAFF }),
      ).rejects.toMatchObject({
        status: 409,
        message: ErrorConstant.TENANT_MEMBER_MESSAGES.LAST_OWNER,
      });
      expect(store.softDelete).not.toHaveBeenCalled();
      expect(store.update).not.toHaveBeenCalled();
    });

    it('remains bound by role, venue and uniqueness validation', async () => {
      await expect(
        service.create(tenantId, actor, { ...dto, role: TenantRole.OWNER }),
      ).rejects.toThrow(BadRequestException);
      store.venueBelongsToTenant.mockResolvedValue(false);
      await expect(service.create(tenantId, actor, dto)).rejects.toThrow(
        BadRequestException,
      );
      store.venueBelongsToTenant.mockResolvedValue(true);
      store.findSameScope.mockResolvedValue(member);
      await expect(service.create(tenantId, actor, dto)).rejects.toThrow(
        ConflictException,
      );
      expect(store.insert).not.toHaveBeenCalled();
    });
  });

  it.each(['create', 'update', 'remove'] as const)(
    'reads the database admin flag once with the actor ID before the %s lock',
    async (operation) => {
      if (operation === 'create') await service.create(tenantId, actor, dto);
      else if (operation === 'update')
        await service.update(member.id, tenantId, actor, {});
      else await service.remove(member.id, tenantId, actor);
      expect(authorization.isPlatformAdmin).toHaveBeenCalledTimes(1);
      expect(authorization.isPlatformAdmin).toHaveBeenCalledWith(actor.id);
      expect(
        authorization.isPlatformAdmin.mock.invocationCallOrder[0],
      ).toBeLessThan(repo.withTenantLock.mock.invocationCallOrder[0]);
      expect(repo.withTenantLock.mock.invocationCallOrder[0]).toBeLessThan(
        store.isActiveOwner.mock.invocationCallOrder[0],
      );
      expect(repo.hasActiveOwner).not.toHaveBeenCalled();
    },
  );

  it('allows a verified tenant contact to claim an empty tenant as its first owner', async () => {
    repo.hasActiveOwner.mockResolvedValue(false);
    store.isActiveOwner.mockResolvedValue(false);
    store.findUserIdByEmail.mockResolvedValue(actor.id);
    const ownerDto = { email: actor.email, role: TenantRole.OWNER };
    store.insert.mockResolvedValue({
      ...member,
      userId: actor.id,
      venueId: null,
      role: TenantRole.OWNER,
    });
    await service.create(tenantId, actor, ownerDto);
    expect(store.insert).toHaveBeenCalledWith(actor.id, TenantRole.OWNER, null);
  });

  it('rejects first-owner claims with an unverified email', async () => {
    repo.hasActiveOwner.mockResolvedValue(false);
    store.isActiveOwner.mockResolvedValue(false);
    await expect(
      service.create(
        tenantId,
        { ...actor, emailVerified: false },
        { email: actor.email, role: TenantRole.OWNER },
      ),
    ).rejects.toThrow(ForbiddenException);
  });

  it('lists only through a tenant-scoped repository call', async () => {
    repo.findAllActive.mockResolvedValue([member]);
    expect((await service.findAll(tenantId, actor)).content).toEqual([member]);
    expect(repo.findAllActive).toHaveBeenCalledWith(tenantId);
  });

  it('finds a member using tenant ID and member ID in that order', async () => {
    expect((await service.findOne(tenantId, member.id, actor)).content).toEqual(
      member,
    );
    expect(repo.findActive).toHaveBeenCalledWith(tenantId, member.id);
  });

  it('uses only the locked store to read and write mutations', async () => {
    await service.update(member.id, tenantId, actor, {
      role: TenantRole.STAFF,
    });
    expect(store.findActive).toHaveBeenCalledWith(member.id);
    expect(store.update).toHaveBeenCalledWith(member.id, {
      role: TenantRole.STAFF,
      venueId: member.venueId,
    });
    await service.remove(member.id, tenantId, actor);
    expect(store.softDelete).toHaveBeenCalledWith(member.id);
    expect(repo.findActive).not.toHaveBeenCalled();
    expect(repo.hasActiveOwner).not.toHaveBeenCalled();
  });

  it.each([0, 1])(
    'protects the last owner with %s other owners',
    async (others) => {
      store.findActive.mockResolvedValue({
        ...member,
        role: TenantRole.OWNER,
        venueId: null,
      });
      store.countActiveOwnersExcept.mockResolvedValue(others);
      const demote = service.update(member.id, tenantId, actor, {
        role: TenantRole.STAFF,
      });
      if (others === 0) {
        await expect(demote).rejects.toMatchObject({
          status: 409,
          message: ErrorConstant.TENANT_MEMBER_MESSAGES.LAST_OWNER,
        });
        await expect(
          service.remove(member.id, tenantId, actor),
        ).rejects.toMatchObject({
          status: 409,
          message: ErrorConstant.TENANT_MEMBER_MESSAGES.LAST_OWNER,
        });
        expect(store.update).not.toHaveBeenCalled();
        expect(store.softDelete).not.toHaveBeenCalled();
      } else {
        await demote;
        await service.remove(member.id, tenantId, actor);
        expect(store.update).toHaveBeenCalled();
        expect(store.softDelete).toHaveBeenCalled();
      }
    },
  );

  it.each([{}, { role: TenantRole.OWNER }])(
    'allows a sole-owner no-op %j',
    async (patch) => {
      store.findActive.mockResolvedValue({
        ...member,
        role: TenantRole.OWNER,
        venueId: null,
      });
      await service.update(member.id, tenantId, actor, patch);
      expect(store.update).toHaveBeenCalledWith(member.id, {
        role: TenantRole.OWNER,
        venueId: null,
      });
    },
  );

  it('validates owner scope before counting owners', async () => {
    await expect(
      service.update(member.id, tenantId, actor, { role: TenantRole.OWNER }),
    ).rejects.toMatchObject({
      status: 400,
      message: ErrorConstant.TENANT_MEMBER_MESSAGES.INVALID_DATA,
    });
    expect(store.countActiveOwnersExcept).not.toHaveBeenCalled();
    expect(store.update).not.toHaveBeenCalled();
  });

  it.each([true, false])(
    'rejects scope collisions with active=%s rows',
    async (isActive) => {
      store.findSameScope.mockResolvedValue({
        ...member,
        venueId: null,
        isActive,
      });
      await expect(
        service.update(member.id, tenantId, actor, { venueId: null }),
      ).rejects.toMatchObject({
        status: 409,
        message: ErrorConstant.TENANT_MEMBER_MESSAGES.ALREADY_EXISTS,
      });
      expect(store.findSameScope).toHaveBeenCalledWith(
        member.userId,
        null,
        member.id,
      );
      expect(store.update).not.toHaveBeenCalled();
    },
  );

  it('rechecks owner authorization inside the lock for both mutations', async () => {
    store.isActiveOwner.mockResolvedValue(false);
    await expect(
      service.update(member.id, tenantId, actor, {}),
    ).rejects.toThrow(ForbiddenException);
    await expect(service.remove(member.id, tenantId, actor)).rejects.toThrow(
      ForbiddenException,
    );
    expect(store.findActive).not.toHaveBeenCalled();
    expect(store.update).not.toHaveBeenCalled();
    expect(store.softDelete).not.toHaveBeenCalled();
  });

  it('rejects an absent or inactive member before mutation', async () => {
    store.findActive.mockResolvedValue(null);
    await expect(
      service.update(member.id, tenantId, actor, {}),
    ).rejects.toThrow(NotFoundException);
    await expect(service.remove(member.id, tenantId, actor)).rejects.toThrow(
      NotFoundException,
    );
    expect(store.update).not.toHaveBeenCalled();
    expect(store.softDelete).not.toHaveBeenCalled();
  });

  it('allows the same user to join a second tenant', async () => {
    await service.create(tenantId, actor, dto);
    expect(store.findUserIdByEmail).toHaveBeenCalledWith(dto.email);
    expect(store.insert).toHaveBeenCalled();
  });

  it('rejects a duplicate membership in the same venue', async () => {
    store.findSameScope.mockResolvedValue(member);
    await expect(service.create(tenantId, actor, dto)).rejects.toThrow(
      ConflictException,
    );
  });

  it('reactivates only the matching membership with the requested role', async () => {
    store.findSameScope.mockResolvedValue({
      ...member,
      isActive: false,
      role: TenantRole.OWNER,
    });
    store.reactivate.mockResolvedValue({
      ...member,
      role: TenantRole.STAFF,
      isActive: true,
    });
    const result = await service.create(tenantId, actor, dto);
    expect(store.findSameScope).toHaveBeenCalledWith(
      member.userId,
      dto.venueId,
    );
    expect(store.reactivate).toHaveBeenCalledWith(member.id, TenantRole.STAFF);
    expect(result.content.role).toBe(TenantRole.STAFF);
    expect(result.message).toBe(
      ErrorConstant.TENANT_MEMBER_MESSAGES.REACTIVATE,
    );
    expect(store.insert).not.toHaveBeenCalled();
  });

  it('rejects a venue belonging to another tenant', async () => {
    store.venueBelongsToTenant.mockResolvedValue(false);
    await expect(service.create(tenantId, actor, dto)).rejects.toThrow(
      BadRequestException,
    );
    await expect(
      service.update(member.id, tenantId, actor, { venueId: dto.venueId }),
    ).rejects.toThrow(BadRequestException);
    expect(store.insert).not.toHaveBeenCalled();
    expect(store.reactivate).not.toHaveBeenCalled();
  });

  it('requires owners to have tenant-wide scope', async () => {
    await expect(
      service.create(tenantId, actor, {
        email: dto.email,
        role: TenantRole.OWNER,
        venueId: dto.venueId,
      }),
    ).rejects.toThrow(BadRequestException);
    expect(store.insert).not.toHaveBeenCalled();
    expect(store.reactivate).not.toHaveBeenCalled();
    await expect(
      service.update(member.id, tenantId, actor, { role: TenantRole.OWNER }),
    ).rejects.toThrow(BadRequestException);
    await service.update(member.id, tenantId, actor, {
      role: TenantRole.OWNER,
      venueId: null,
    });
    expect(store.update).toHaveBeenCalledWith(member.id, {
      role: TenantRole.OWNER,
      venueId: null,
    });
  });

  it('returns not found for an unknown user', async () => {
    store.findUserIdByEmail.mockResolvedValue(null);
    await expect(service.create(tenantId, actor, dto)).rejects.toThrow(
      NotFoundException,
    );
  });
  it.each([
    [
      'TENANT_NOT_FOUND',
      404,
      ErrorConstant.TENANT_MEMBER_MESSAGES.TENANT_NOT_FOUND,
    ],
    [
      'ALREADY_EXISTS',
      409,
      ErrorConstant.TENANT_MEMBER_MESSAGES.ALREADY_EXISTS,
    ],
    ['BUSY', 409, ErrorConstant.TENANT_MEMBER_MESSAGES.BUSY],
  ] as const)('maps lock outcome %s', async (kind, status, message) => {
    repo.withTenantLock.mockResolvedValue({ kind });
    await expect(service.create(tenantId, actor, dto)).rejects.toMatchObject({
      status,
      message,
    });
  });
});
