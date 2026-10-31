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
import { TenantRepository } from '../tenant/tenant.repository';
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
  const user = {
    id: 'target-1',
    email: dto.email,
    name: 'Target',
    emailVerified: true,
    image: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  const repo = {
    hasActiveOwner: jest.fn<TenantMemberRepository['hasActiveOwner']>(),
    hasAnyMember: jest.fn<TenantMemberRepository['hasAnyMember']>(),
    venueBelongsToTenant:
      jest.fn<TenantMemberRepository['venueBelongsToTenant']>(),
    getValidMember: jest.fn<TenantMemberRepository['getValidMember']>(),
    findInactive: jest.fn<TenantMemberRepository['findInactive']>(),
    reactivate: jest.fn<TenantMemberRepository['reactivate']>(),
    create: jest.fn<TenantMemberRepository['create']>(),
    findAllActive: jest.fn<TenantMemberRepository['findAllActive']>(),
    findActive: jest.fn<TenantMemberRepository['findActive']>(),
    update: jest.fn<TenantMemberRepository['update']>(),
    delete: jest.fn<TenantMemberRepository['delete']>(),
  };
  const tenants = {
    findById: jest.fn<TenantRepository['findById']>(),
  };
  let service: TenantMemberService;

  beforeEach(async () => {
    Object.values(repo).forEach((mock) => mock.mockReset());
    tenants.findById.mockReset();
    repo.hasActiveOwner.mockResolvedValue(true);
    repo.venueBelongsToTenant.mockResolvedValue(true);
    repo.getValidMember.mockResolvedValue({
      existingUser: [user],
      tenantMembers: [],
    });
    repo.findInactive.mockResolvedValue(null);
    repo.create.mockResolvedValue(member);
    repo.findActive.mockResolvedValue(member);
    repo.update.mockResolvedValue(member);
    repo.delete.mockResolvedValue({ ...member, isActive: false });
    tenants.findById.mockResolvedValue({
      id: tenantId,
      name: 'Tenant',
      status: 'ACTIVE',
      email: actor.email,
    } as Awaited<ReturnType<TenantRepository['findById']>>);
    const module = await Test.createTestingModule({
      providers: [
        TenantMemberService,
        { provide: TenantMemberRepository, useValue: repo },
        { provide: TenantRepository, useValue: tenants },
      ],
    }).compile();
    service = module.get(TenantMemberService);
  });

  it('rejects every operation when the actor is not an active owner', async () => {
    repo.hasActiveOwner.mockResolvedValue(false);
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
      service.update(member.id, tenantId, actor, { role: TenantRole.CUSTOMER }),
    ).rejects.toThrow(ForbiddenException);
    await expect(service.remove(member.id, tenantId, actor)).rejects.toThrow(
      ForbiddenException,
    );
    expect(repo.findAllActive).not.toHaveBeenCalled();
    expect(repo.update).not.toHaveBeenCalled();
    expect(repo.delete).not.toHaveBeenCalled();
  });

  it('allows a verified tenant contact to claim an empty tenant as its first owner', async () => {
    repo.hasActiveOwner.mockResolvedValue(false);
    repo.hasAnyMember.mockResolvedValue(false);
    repo.getValidMember.mockResolvedValue({
      existingUser: [{ ...user, id: actor.id, email: actor.email }],
      tenantMembers: [],
    });
    const ownerDto = { email: actor.email, role: TenantRole.OWNER };
    repo.create.mockResolvedValue({
      ...member,
      userId: actor.id,
      venueId: null,
      role: TenantRole.OWNER,
    });
    await service.create(tenantId, actor, ownerDto);
    expect(repo.create).toHaveBeenCalledWith(
      actor.id,
      TenantRole.OWNER,
      tenantId,
      undefined,
    );
  });

  it('rejects first-owner claims with an unverified email', async () => {
    repo.hasActiveOwner.mockResolvedValue(false);
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
      role: TenantRole.CUSTOMER,
    });
    expect(repo.findActive).toHaveBeenCalledWith(tenantId, member.id);
    expect(repo.update).toHaveBeenCalledWith(
      member.id,
      tenantId,
      TenantRole.CUSTOMER,
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
    expect(repo.getValidMember).toHaveBeenCalledWith(dto.email, tenantId);
    expect(repo.create).toHaveBeenCalled();
  });

  it('rejects a duplicate membership in the same venue', async () => {
    repo.getValidMember.mockResolvedValue({
      existingUser: [user],
      tenantMembers: [member],
    });
    await expect(service.create(tenantId, actor, dto)).rejects.toThrow(
      ConflictException,
    );
  });

  it('reactivates only the matching membership with the requested role', async () => {
    repo.findInactive.mockResolvedValue({
      ...member,
      isActive: false,
      role: TenantRole.OWNER,
    });
    repo.reactivate.mockResolvedValue({
      ...member,
      role: TenantRole.STAFF,
      isActive: true,
    });
    const result = await service.create(tenantId, actor, dto);
    expect(repo.findInactive).toHaveBeenCalledWith(
      user.id,
      tenantId,
      dto.venueId,
    );
    expect(repo.reactivate).toHaveBeenCalledWith(
      member.id,
      tenantId,
      TenantRole.STAFF,
      dto.venueId,
    );
    expect(result.content.role).toBe(TenantRole.STAFF);
    expect(repo.create).not.toHaveBeenCalled();
  });

  it('rejects a venue belonging to another tenant', async () => {
    repo.venueBelongsToTenant.mockResolvedValue(false);
    await expect(service.create(tenantId, actor, dto)).rejects.toThrow(
      BadRequestException,
    );
    await expect(
      service.update(member.id, tenantId, actor, { venueId: dto.venueId }),
    ).rejects.toThrow(BadRequestException);
  });

  it('requires owners to have tenant-wide scope', async () => {
    await expect(
      service.create(tenantId, actor, {
        email: dto.email,
        role: TenantRole.OWNER,
        venueId: dto.venueId,
      }),
    ).rejects.toThrow(BadRequestException);
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
    repo.getValidMember.mockResolvedValue({
      existingUser: [],
      tenantMembers: [],
    });
    await expect(service.create(tenantId, actor, dto)).rejects.toThrow(
      NotFoundException,
    );
  });
});
