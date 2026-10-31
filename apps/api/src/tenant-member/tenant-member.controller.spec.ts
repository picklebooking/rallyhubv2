import { jest } from '@jest/globals';
import { Test } from '@nestjs/testing';
import type { UserSession } from '@thallesp/nestjs-better-auth';
import { TenantRole } from '../generated/prisma/enums';
import type { ITenantGeneric } from '../interface/ITenantMember.interface';
import { TenantMemberController } from './tenant-member.controller';
import { TenantMemberService } from './tenant-member.service';

describe('TenantMemberController', () => {
  const actor = {
    id: 'owner-user',
    email: 'owner@example.com',
    emailVerified: true,
  };
  const session = { user: actor } as unknown as UserSession;
  const member: ITenantGeneric = {
    id: 'member-1',
    userId: 'target-user',
    tenantId: 'tenant-1',
    venueId: null,
    role: TenantRole.STAFF,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  const response = { message: 'ok', content: member };
  const mocks = {
    create: jest.fn<TenantMemberService['create']>(),
    findAll: jest.fn<TenantMemberService['findAll']>(),
    findOne: jest.fn<TenantMemberService['findOne']>(),
    update: jest.fn<TenantMemberService['update']>(),
    remove: jest.fn<TenantMemberService['remove']>(),
  };

  let controller: TenantMemberController;

  beforeEach(async () => {
    Object.values(mocks).forEach((mock) => mock.mockReset());
    const module = await Test.createTestingModule({
      controllers: [TenantMemberController],
      providers: [{ provide: TenantMemberService, useValue: mocks }],
    }).compile();
    controller = module.get(TenantMemberController);
  });

  it('passes the resolved tenant and authenticated actor to create', async () => {
    const dto = { email: 'target@example.com', role: TenantRole.STAFF };
    mocks.create.mockResolvedValue(response);
    expect(await controller.create('tenant-1', session, dto)).toEqual(response);
    expect(mocks.create).toHaveBeenCalledWith('tenant-1', actor, dto);
  });

  it('passes the resolved tenant and authenticated actor to list', async () => {
    mocks.findAll.mockResolvedValue({ message: 'ok', content: [member] });
    await controller.findAll('tenant-1', session);
    expect(mocks.findAll).toHaveBeenCalledWith('tenant-1', actor);
  });

  it('passes the member ID separately from tenant ID for a single read', async () => {
    mocks.findOne.mockResolvedValue(response);
    await controller.findOne('tenant-1', 'member-1', session);
    expect(mocks.findOne).toHaveBeenCalledWith('tenant-1', 'member-1', actor);
  });

  it('passes both IDs and the actor to update', async () => {
    const dto = { role: TenantRole.CUSTOMER };
    mocks.update.mockResolvedValue(response);
    await controller.update('member-1', 'tenant-1', session, dto);
    expect(mocks.update).toHaveBeenCalledWith(
      'member-1',
      'tenant-1',
      actor,
      dto,
    );
  });

  it('passes both IDs and the actor to delete', async () => {
    mocks.remove.mockResolvedValue(response);
    await controller.remove('member-1', 'tenant-1', session);
    expect(mocks.remove).toHaveBeenCalledWith('member-1', 'tenant-1', actor);
  });
});
