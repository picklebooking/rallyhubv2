import { jest } from '@jest/globals';
import { ForbiddenException } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client';
import { INTERACTIVE_TX_OPTIONS } from '../prisma/interactive-transaction';
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
  const tenantUpdateMany = jest.fn<() => Promise<{ count: number }>>();
  const create = jest.fn<() => Promise<ITenantGeneric>>();
  const userFindMany = jest.fn<() => Promise<unknown[]>>();
  const venueFindFirst = jest.fn<() => Promise<unknown>>();
  const prisma = {
    db: {
      tenantMember: { findFirst, findMany, update, create },
      tenant: { updateMany: tenantUpdateMany },
      user: { findMany: userFindMany },
      venue: { findFirst: venueFindFirst },
    },
  } as unknown as PrismaService;
  const transaction = jest.fn(
    async (work: (tx: Prisma.TransactionClient) => Promise<unknown>) =>
      work(prisma.db as unknown as Prisma.TransactionClient),
  );
  Object.assign(prisma.db, { $transaction: transaction });
  const repository = new TenantMemberRepository(prisma);

  beforeEach(() => {
    transaction.mockClear();
    tenantUpdateMany.mockReset().mockResolvedValue({ count: 1 });
    create.mockReset().mockResolvedValue(member);
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

  it('locks the tenant before invoking work and uses bounded transactions', async () => {
    const work = jest.fn(() => {
      expect(tenantUpdateMany).toHaveBeenCalledWith({
        where: { id: 'tenant-1' },
        data: { updatedAt: expect.any(Date) as Date },
      });
      expect(findFirst).not.toHaveBeenCalled();
      return Promise.resolve('result');
    });
    expect(await repository.withTenantLock('tenant-1', work)).toEqual({
      kind: 'DONE',
      value: 'result',
    });
    expect(transaction).toHaveBeenCalledWith(
      expect.any(Function),
      INTERACTIVE_TX_OPTIONS,
    );
  });

  it('returns missing tenant without running work', async () => {
    tenantUpdateMany.mockResolvedValue({ count: 0 });
    const work = jest.fn(() => Promise.resolve('unused'));
    expect(await repository.withTenantLock('tenant-1', work)).toEqual({
      kind: 'TENANT_NOT_FOUND',
    });
    expect(work).not.toHaveBeenCalled();
  });

  it.each([
    ['P2002', 'ALREADY_EXISTS'],
    ['P2034', 'BUSY'],
    ['P2028', 'BUSY'],
  ])('maps %s after transaction rejection', async (code, kind) => {
    const error = new Prisma.PrismaClientKnownRequestError('failure', {
      code,
      clientVersion: 'test',
    });
    expect(
      await repository.withTenantLock('tenant-1', () => Promise.reject(error)),
    ).toEqual({ kind });
  });

  it('rethrows service rejections after transaction rollback', async () => {
    const error = new ForbiddenException();
    await expect(
      repository.withTenantLock('tenant-1', () => Promise.reject(error)),
    ).rejects.toBe(error);
  });

  it('queries the exact scope including null and optional exclusion', async () => {
    await repository.withTenantLock('tenant-1', async (store) => {
      await store.findSameScope('u', null);
      expect(findFirst).toHaveBeenLastCalledWith({
        where: { tenantId: 'tenant-1', userId: 'u', venueId: null },
      });
      await store.findSameScope('u', 'v', 'other');
      expect(findFirst).toHaveBeenLastCalledWith({
        where: {
          tenantId: 'tenant-1',
          userId: 'u',
          venueId: 'v',
          id: { not: 'other' },
        },
      });
    });
  });

  it('binds inserts and reactivation to the locked tenant', async () => {
    await repository.withTenantLock('tenant-1', async (store) => {
      await store.insert('u', TenantRole.STAFF, null);
      expect(create).toHaveBeenCalledWith({
        data: {
          tenantId: 'tenant-1',
          userId: 'u',
          role: TenantRole.STAFF,
          venueId: null,
        },
      });
      await store.reactivate('member-1', TenantRole.STAFF);
      expect(update).toHaveBeenCalledWith({
        where: { id: 'member-1', tenantId: 'tenant-1', isActive: false },
        data: { isActive: true, role: TenantRole.STAFF },
      });
    });
  });
});
