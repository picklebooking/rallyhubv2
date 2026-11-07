import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AuthorizationRepository } from '../authorization/authorization.repository';
import { ErrorConstant } from '../constants/error-code.constant';
import type {
  ITenantGeneric,
  ITenantMember,
} from '../interface/ITenantMember.interface';
import type {
  LockedMembershipStore,
  TenantLockOutcome,
} from './tenant-member.repository';
import {
  isValidFirstOwnerClaim,
  isValidRoleScope,
  wouldRemoveLastOwner,
} from './tenant-member.rules';
import type { MembershipState } from './tenant-member.rules';
import type { CreateTenantMemberDto } from './dto/create-tenant-member.dto';
import type { UpdateTenantMemberDto } from './dto/update-tenant-member.dto';
import { TenantMemberRepository } from './tenant-member.repository';

export type TenantMemberActor = {
  id: string;
  email: string;
  emailVerified: boolean;
};

@Injectable()
export class TenantMemberService {
  constructor(
    private readonly tenantMemberRepository: TenantMemberRepository,
    private readonly authorizationRepository: AuthorizationRepository,
  ) {}

  public async create(
    tenantId: string,
    actor: TenantMemberActor,
    dto: CreateTenantMemberDto,
  ): Promise<ITenantMember<ITenantGeneric>> {
    const isPlatformAdmin = await this.authorizationRepository.isPlatformAdmin(
      actor.id,
    );
    const outcome = await this.tenantMemberRepository.withTenantLock(
      tenantId,
      async (store) => {
        await this.authorizeMutation(store, actor, isPlatformAdmin, dto);
        const { email, role } = dto;
        const venueId = dto.venueId ?? null;
        const userId = await store.findUserIdByEmail(email);
        if (userId === null)
          throw new NotFoundException(
            ErrorConstant.TENANT_MEMBER_MESSAGES.NOT_FOUND,
          );
        const existing = await store.findSameScope(userId, venueId);
        if (existing?.isActive)
          throw new ConflictException(
            ErrorConstant.TENANT_MEMBER_MESSAGES.ALREADY_EXISTS,
          );
        if (
          !isValidRoleScope(role, venueId) ||
          (venueId !== null && !(await store.venueBelongsToTenant(venueId)))
        ) {
          throw new BadRequestException(
            ErrorConstant.TENANT_MEMBER_MESSAGES.INVALID_DATA,
          );
        }
        if (existing) {
          return {
            message: ErrorConstant.TENANT_MEMBER_MESSAGES.REACTIVATE,
            content: await store.reactivate(existing.id, role),
          };
        }
        return {
          message: ErrorConstant.TENANT_MEMBER_MESSAGES.CREATED,
          content: await store.insert(userId, role, venueId),
        };
      },
    );
    return this.unwrapLock(outcome);
  }

  public async findAll(
    tenantId: string,
    actor: TenantMemberActor,
  ): Promise<ITenantMember<ITenantGeneric[]>> {
    await this.assertCanRead(tenantId, actor);
    const members = await this.tenantMemberRepository.findAllActive(tenantId);
    return {
      message: members.length
        ? ErrorConstant.TENANT_MEMBER_MESSAGES.LIST_FOUND
        : ErrorConstant.TENANT_MEMBER_MESSAGES.EMPTY,
      content: members,
    };
  }

  public async findOne(
    tenantId: string,
    memberId: string,
    actor: TenantMemberActor,
  ): Promise<ITenantMember<ITenantGeneric>> {
    await this.assertCanRead(tenantId, actor);
    const member = await this.tenantMemberRepository.findActive(
      tenantId,
      memberId,
    );
    if (!member) {
      throw new NotFoundException(
        ErrorConstant.TENANT_MEMBER_MESSAGES.NOT_FOUND,
      );
    }
    return {
      message: ErrorConstant.TENANT_MEMBER_MESSAGES.FOUND,
      content: member,
    };
  }

  public async update(
    memberId: string,
    tenantId: string,
    actor: TenantMemberActor,
    dto: UpdateTenantMemberDto,
  ): Promise<ITenantMember<ITenantGeneric>> {
    const isPlatformAdmin = await this.authorizationRepository.isPlatformAdmin(
      actor.id,
    );
    const outcome = await this.tenantMemberRepository.withTenantLock(
      tenantId,
      async (store) => {
        await this.authorizeMutation(store, actor, isPlatformAdmin);
        const target = await store.findActive(memberId);
        if (!target)
          throw new NotFoundException(
            ErrorConstant.TENANT_MEMBER_MESSAGES.NOT_FOUND,
          );
        const next: MembershipState = {
          role: dto.role ?? target.role,
          venueId: dto.venueId === undefined ? target.venueId : dto.venueId,
          isActive: true,
        };
        if (
          !isValidRoleScope(next.role, next.venueId) ||
          (next.venueId !== null &&
            !(await store.venueBelongsToTenant(next.venueId)))
        )
          throw new BadRequestException(
            ErrorConstant.TENANT_MEMBER_MESSAGES.INVALID_DATA,
          );
        if (
          wouldRemoveLastOwner(
            target,
            next,
            await store.countActiveOwnersExcept(target.id),
          )
        )
          throw new ConflictException(
            ErrorConstant.TENANT_MEMBER_MESSAGES.LAST_OWNER,
          );
        if (
          next.venueId !== target.venueId &&
          (await store.findSameScope(target.userId, next.venueId, target.id))
        )
          throw new ConflictException(
            ErrorConstant.TENANT_MEMBER_MESSAGES.ALREADY_EXISTS,
          );
        return {
          message: ErrorConstant.TENANT_MEMBER_MESSAGES.UPDATED,
          content: await store.update(target.id, {
            role: next.role,
            venueId: next.venueId,
          }),
        };
      },
    );
    return this.unwrapLock(outcome);
  }

  public async remove(
    memberId: string,
    tenantId: string,
    actor: TenantMemberActor,
  ): Promise<ITenantMember<ITenantGeneric>> {
    const isPlatformAdmin = await this.authorizationRepository.isPlatformAdmin(
      actor.id,
    );
    const outcome = await this.tenantMemberRepository.withTenantLock(
      tenantId,
      async (store) => {
        await this.authorizeMutation(store, actor, isPlatformAdmin);
        const target = await store.findActive(memberId);
        if (!target)
          throw new NotFoundException(
            ErrorConstant.TENANT_MEMBER_MESSAGES.NOT_FOUND,
          );
        if (
          wouldRemoveLastOwner(
            target,
            { ...target, isActive: false },
            await store.countActiveOwnersExcept(target.id),
          )
        )
          throw new ConflictException(
            ErrorConstant.TENANT_MEMBER_MESSAGES.LAST_OWNER,
          );
        return {
          message: ErrorConstant.TENANT_MEMBER_MESSAGES.DELETED,
          content: await store.softDelete(target.id),
        };
      },
    );
    return this.unwrapLock(outcome);
  }

  private async authorizeMutation(
    store: LockedMembershipStore,
    actor: TenantMemberActor,
    isPlatformAdmin: boolean,
    claim?: CreateTenantMemberDto,
  ): Promise<void> {
    if (await store.isActiveOwner(actor.id)) return;
    if (isPlatformAdmin) return;
    if (
      claim &&
      isValidFirstOwnerClaim({
        actorEmail: actor.email,
        actorEmailVerified: actor.emailVerified,
        requestEmail: claim.email,
        requestRole: claim.role,
        requestVenueId: claim.venueId ?? null,
        tenantEmail: await store.findTenantEmail(),
        tenantHasAnyMember: await store.hasAnyMember(),
      })
    )
      return;
    throw new ForbiddenException(
      ErrorConstant.TENANT_MEMBER_MESSAGES.FORBIDDEN,
    );
  }

  private unwrapLock<T>(outcome: TenantLockOutcome<T>): T {
    switch (outcome.kind) {
      case 'DONE':
        return outcome.value;
      case 'TENANT_NOT_FOUND':
        throw new NotFoundException(
          ErrorConstant.TENANT_MEMBER_MESSAGES.TENANT_NOT_FOUND,
        );
      case 'ALREADY_EXISTS':
        throw new ConflictException(
          ErrorConstant.TENANT_MEMBER_MESSAGES.ALREADY_EXISTS,
        );
      case 'BUSY':
        throw new ConflictException(ErrorConstant.TENANT_MEMBER_MESSAGES.BUSY);
    }
  }

  private async assertCanRead(
    tenantId: string,
    actor: TenantMemberActor,
  ): Promise<void> {
    if (await this.tenantMemberRepository.hasActiveOwner(tenantId, actor.id))
      return;
    if (await this.authorizationRepository.isPlatformAdmin(actor.id)) return;
    throw new ForbiddenException(
      ErrorConstant.TENANT_MEMBER_MESSAGES.FORBIDDEN,
    );
  }
}
