import { jest } from '@jest/globals';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
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
  };
  const repo = {
    hasActiveOwner: jest.fn<TenantMemberRepository['hasActiveOwner']>(),
    withTenantLock: jest.fn<TenantMemberRepository['withTenantLock']>(),
    venueBelongsToTenant:
      jest.fn<TenantMemberRepository['venueBelongsToTenant']>(),
    findAllActive: jest.fn<TenantMemberRepository['findAllActive']>(),
    findActive: jest.fn<TenantMemberRepository['findActive']>(),
    update: jest.fn<TenantMemberRepository['update']>(),
    delete: jest.fn<TenantMemberRepository['delete']>(),
  };
  let service: TenantMemberService;

  beforeEach(async () => {
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
    repo.venueBelongsToTenant.mockResolvedValue(true);
    repo.findActive.mockResolvedValue(member);
    repo.update.mockResolvedValue(member);
    repo.delete.mockResolvedValue({ ...member, isActive: false });
    const module = await Test.createTestingModule({
      providers: [
        TenantMemberService,
        { provide: TenantMemberRepository, useValue: repo },
      ],
    }).compile();
    service = module.get(TenantMemberService);
  });

  it('rejects every operation when the actor is not an active owner', async () => {
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
    expect(repo.update).not.toHaveBeenCalled();
    expect(repo.delete).not.toHaveBeenCalled();
  });

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

  it('scopes updates and deletes through both the read and write', async () => {
    await service.update(member.id, tenantId, actor, {
      role: TenantRole.STAFF,
    });
    expect(repo.findActive).toHaveBeenCalledWith(tenantId, member.id);
    expect(repo.update).toHaveBeenCalledWith(
      member.id,
      tenantId,
      TenantRole.STAFF,
      undefined,
    );
    await service.remove(member.id, tenantId, actor);
    expect(repo.delete).toHaveBeenCalledWith(member.id, tenantId);
  });

  it('rejects an absent or inactive member before mutation', async () => {
    repo.findActive.mockResolvedValue(null);
    await expect(
      service.update(member.id, tenantId, actor, {}),
    ).rejects.toThrow(NotFoundException);
    await expect(service.remove(member.id, tenantId, actor)).rejects.toThrow(
      NotFoundException,
    );
    expect(repo.update).not.toHaveBeenCalled();
    expect(repo.delete).not.toHaveBeenCalled();
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
    repo.venueBelongsToTenant.mockResolvedValue(false);
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
    expect(repo.update).toHaveBeenCalledWith(
      member.id,
      tenantId,
      TenantRole.OWNER,
      null,
    );
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
