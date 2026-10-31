import { jest } from '@jest/globals';
import { TenantRole } from '../generated/prisma/enums';
import type { ITenantGeneric } from '../interface/ITenantMember.interface';
import { PrismaService } from '../prisma/prisma.service';
import { TenantMemberRepository } from './tenant-member.repository';

describe('TenantMemberRepository tenant scoping', () => {
  const member: ITenantGeneric = {
    id: 'member-1',
    userId: 'user-1',
    tenantId: 'tenant-1',
    venueId: null,
    role: TenantRole.OWNER,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  const findFirst = jest.fn<() => Promise<ITenantGeneric | null>>();
  const findMany = jest.fn<() => Promise<ITenantGeneric[]>>();
  const update = jest.fn<() => Promise<ITenantGeneric>>();
  const userFindMany = jest.fn<() => Promise<unknown[]>>();
  const venueFindFirst = jest.fn<() => Promise<unknown>>();
  const prisma = {
    db: {
      tenantMember: { findFirst, findMany, update },
      user: { findMany: userFindMany },
      venue: { findFirst: venueFindFirst },
    },
  } as unknown as PrismaService;
  const repository = new TenantMemberRepository(prisma);

  beforeEach(() => {
    findFirst.mockReset();
    findMany.mockReset();
    update.mockReset();
    userFindMany.mockReset();
    venueFindFirst.mockReset();
    findFirst.mockResolvedValue(member);
    findMany.mockResolvedValue([member]);
    update.mockResolvedValue(member);
  });

  it('limits owner authorization to active tenant-wide owners', async () => {
    expect(await repository.hasActiveOwner('tenant-1', 'user-1')).toBe(true);
    expect(findFirst).toHaveBeenCalledWith({
      where: {
        tenantId: 'tenant-1',
        userId: 'user-1',
        role: TenantRole.OWNER,
        venueId: null,
        isActive: true,
      },
      select: { id: true },
    });
  });

  it('scopes list and single reads to active members of the tenant', async () => {
    await repository.findAllActive('tenant-1');
    expect(findMany).toHaveBeenCalledWith({
      where: { tenantId: 'tenant-1', isActive: true },
    });
    await repository.findActive('tenant-1', 'member-1');
    expect(findFirst).toHaveBeenCalledWith({
      where: { tenantId: 'tenant-1', id: 'member-1', isActive: true },
    });
  });

  it('scopes both mutations to active records in the tenant', async () => {
    await repository.update('member-1', 'tenant-1', TenantRole.STAFF);
    expect(update).toHaveBeenCalledWith({
      where: { id: 'member-1', tenantId: 'tenant-1', isActive: true },
      data: { role: TenantRole.STAFF, venueId: undefined },
    });
    await repository.delete('member-1', 'tenant-1');
    expect(update).toHaveBeenCalledWith({
      where: { id: 'member-1', tenantId: 'tenant-1', isActive: true },
      data: { isActive: false },
    });
  });

  it('checks duplicates within the requested tenant only', async () => {
    userFindMany.mockResolvedValue([]);
    await repository.getValidMember('user@example.com', 'tenant-1');
    expect(findMany).toHaveBeenCalledWith({
      where: {
        tenantId: 'tenant-1',
        isActive: true,
        user: { email: 'user@example.com' },
      },
    });
  });

  it('reactivates only the matching row with the new role', async () => {
    await repository.reactivate(
      'member-1',
      'tenant-1',
      TenantRole.STAFF,
      undefined,
    );
    expect(update).toHaveBeenCalledWith({
      where: { id: 'member-1', tenantId: 'tenant-1', isActive: false },
      data: { isActive: true, role: TenantRole.STAFF, venueId: undefined },
    });
  });
});
