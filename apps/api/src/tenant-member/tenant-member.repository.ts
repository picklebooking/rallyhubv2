import { Injectable } from '@nestjs/common';
import { TenantRole } from '../generated/prisma/enums';
import { Prisma } from '../generated/prisma/client';
import type { BusyOutcome } from '../open-play/open-play.repository';
import {
  INTERACTIVE_TX_OPTIONS,
  isRetryableTransactionError,
} from '../prisma/interactive-transaction';
import type { ITenantGeneric } from '../interface/ITenantMember.interface';
import { PrismaService } from '../prisma/prisma.service';

export interface LockedMembershipStore {
  isActiveOwner(userId: string): Promise<boolean>;
  hasAnyMember(): Promise<boolean>;
  findTenantEmail(): Promise<string | null>;
  findUserIdByEmail(email: string): Promise<string | null>;
  venueBelongsToTenant(venueId: string): Promise<boolean>;
  findSameScope(
    userId: string,
    venueId: string | null,
    excludeMemberId?: string,
  ): Promise<ITenantGeneric | null>;
  insert(
    userId: string,
    role: TenantRole,
    venueId: string | null,
  ): Promise<ITenantGeneric>;
  reactivate(memberId: string, role: TenantRole): Promise<ITenantGeneric>;
}

export type TenantLockOutcome<T> =
  | { kind: 'DONE'; value: T }
  | { kind: 'TENANT_NOT_FOUND' }
  | { kind: 'ALREADY_EXISTS' }
  | BusyOutcome;

@Injectable()
export class TenantMemberRepository {
  /**
   * Constructs the `TenantMemberRepository` and injects needed services.
   *
   * @param {PrismaService} prismaService Service responsible with interacting in the database.
   */
  constructor(private readonly prismaService: PrismaService) {}

  /**
   * Every membership write must go through this tenant lock. Rejections must
   * be thrown, never returned, so the tenant timestamp write rolls back too.
   * Legacy update/delete migrate to this boundary in the next plan task.
   */
  public async withTenantLock<T>(
    tenantId: string,
    work: (store: LockedMembershipStore) => Promise<T>,
  ): Promise<TenantLockOutcome<T>> {
    try {
      return await this.prismaService.db.$transaction(async (tx) => {
        const lock = await tx.tenant.updateMany({
          where: { id: tenantId },
          data: { updatedAt: new Date() },
        });
        if (lock.count === 0) return { kind: 'TENANT_NOT_FOUND' };
        return {
          kind: 'DONE',
          value: await work(this.lockedStore(tx, tenantId)),
        };
      }, INTERACTIVE_TX_OPTIONS);
    } catch (error: unknown) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      )
        return { kind: 'ALREADY_EXISTS' };
      if (isRetryableTransactionError(error)) return { kind: 'BUSY' };
      throw error;
    }
  }

  private lockedStore(
    tx: Prisma.TransactionClient,
    tenantId: string,
  ): LockedMembershipStore {
    return {
      isActiveOwner: async (userId) =>
        (await tx.tenantMember.findFirst({
          where: {
            tenantId,
            userId,
            role: TenantRole.OWNER,
            venueId: null,
            isActive: true,
          },
          select: { id: true },
        })) !== null,
      hasAnyMember: async () =>
        (await tx.tenantMember.findFirst({
          where: { tenantId },
          select: { id: true },
        })) !== null,
      findTenantEmail: async () =>
        (
          await tx.tenant.findUnique({
            where: { id: tenantId },
            select: { email: true },
          })
        )?.email ?? null,
      findUserIdByEmail: async (email) =>
        (await tx.user.findUnique({ where: { email }, select: { id: true } }))
          ?.id ?? null,
      venueBelongsToTenant: async (venueId) =>
        (await tx.venue.findFirst({
          where: { id: venueId, tenantId },
          select: { id: true },
        })) !== null,
      findSameScope: (userId, venueId, excludeMemberId) =>
        tx.tenantMember.findFirst({
          where: {
            tenantId,
            userId,
            venueId,
            ...(excludeMemberId === undefined
              ? {}
              : { id: { not: excludeMemberId } }),
          },
        }),
      insert: (userId, role, venueId) =>
        tx.tenantMember.create({ data: { tenantId, userId, role, venueId } }),
      reactivate: (id, role) =>
        tx.tenantMember.update({
          where: { id, tenantId, isActive: false },
          data: { isActive: true, role },
        }),
    };
  }

  public async hasActiveOwner(
    tenantId: string,
    userId: string,
  ): Promise<boolean> {
    const owner = await this.prismaService.db.tenantMember.findFirst({
      where: {
        tenantId,
        userId,
        role: TenantRole.OWNER,
        venueId: null,
        isActive: true,
      },
      select: { id: true },
    });
    return owner !== null;
  }

  /** Temporary read bridge for legacy update; removed when update is locked. */
  public async venueBelongsToTenant(
    venueId: string,
    tenantId: string,
  ): Promise<boolean> {
    const venue = await this.prismaService.db.venue.findFirst({
      where: { id: venueId, tenantId },
      select: { id: true },
    });
    return venue !== null;
  }

  public async findAllActive(tenantId: string): Promise<ITenantGeneric[]> {
    return this.prismaService.db.tenantMember.findMany({
      where: { tenantId, isActive: true },
    });
  }

  public async findActive(
    tenantId: string,
    memberId: string,
  ): Promise<ITenantGeneric | null> {
    return this.prismaService.db.tenantMember.findFirst({
      where: { tenantId, id: memberId, isActive: true },
    });
  }

  /** Legacy scoped update; migrated to the tenant lock in Task 5. */
  public async update(
    id: string,
    tenantId: string,
    role?: TenantRole,
    venueId?: string | null,
  ): Promise<ITenantGeneric> {
    return await this.prismaService.db.tenantMember.update({
      where: { id, tenantId, isActive: true },
      data: {
        role,
        venueId,
      },
    });
  }

  /** Legacy scoped soft-delete; migrated to the tenant lock in Task 5. */
  public async delete(id: string, tenantId: string): Promise<ITenantGeneric> {
    return await this.prismaService.db.tenantMember.update({
      where: { id, tenantId, isActive: true },
      data: {
        isActive: false,
      },
    });
  }
}
