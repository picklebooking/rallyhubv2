import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ErrorConstant } from '../constants/error-code.constant';
import { TenantRole } from '../generated/prisma/enums';
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
} from './tenant-member.rules';
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
  ) {}

  public async create(
    tenantId: string,
    actor: TenantMemberActor,
    dto: CreateTenantMemberDto,
  ): Promise<ITenantMember<ITenantGeneric>> {
    const outcome = await this.tenantMemberRepository.withTenantLock(
      tenantId,
      async (store) => {
        await this.authorizeMutation(store, actor, dto);
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
    await this.assertOwner(tenantId, actor);
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
    await this.assertOwner(tenantId, actor);
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
    await this.assertOwner(tenantId, actor);
    const member = await this.tenantMemberRepository.findActive(
      tenantId,
      memberId,
    );
    if (!member) {
      throw new NotFoundException(
        ErrorConstant.TENANT_MEMBER_MESSAGES.NOT_FOUND,
      );
    }
    const effectiveVenueId =
      dto.venueId === undefined ? member.venueId : dto.venueId;
    this.assertRoleVenue(dto.role ?? member.role, effectiveVenueId);
    await this.assertVenueBelongsToTenant(tenantId, effectiveVenueId);
    const updated = await this.tenantMemberRepository.update(
      memberId,
      tenantId,
      dto.role,
      dto.venueId,
    );
    return {
      message: ErrorConstant.TENANT_MEMBER_MESSAGES.UPDATED,
      content: updated,
    };
  }

  public async remove(
    memberId: string,
    tenantId: string,
    actor: TenantMemberActor,
  ): Promise<ITenantMember<ITenantGeneric>> {
    await this.assertOwner(tenantId, actor);
    const member = await this.tenantMemberRepository.findActive(
      tenantId,
      memberId,
    );
    if (!member) {
      throw new NotFoundException(
        ErrorConstant.TENANT_MEMBER_MESSAGES.NOT_FOUND,
      );
    }
    const deleted = await this.tenantMemberRepository.delete(
      memberId,
      tenantId,
    );
    return {
      message: ErrorConstant.TENANT_MEMBER_MESSAGES.DELETED,
      content: deleted,
    };
  }

  private async authorizeMutation(
    store: LockedMembershipStore,
    actor: TenantMemberActor,
    claim?: CreateTenantMemberDto,
  ): Promise<void> {
    if (await store.isActiveOwner(actor.id)) return;
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

  private async assertOwner(
    tenantId: string,
    actor: TenantMemberActor,
  ): Promise<void> {
    if (await this.tenantMemberRepository.hasActiveOwner(tenantId, actor.id))
      return;
    throw new ForbiddenException(
      ErrorConstant.TENANT_MEMBER_MESSAGES.FORBIDDEN,
    );
  }

  private async assertVenueBelongsToTenant(
    tenantId: string,
    venueId: string | null | undefined,
  ): Promise<void> {
    if (
      venueId &&
      !(await this.tenantMemberRepository.venueBelongsToTenant(
        venueId,
        tenantId,
      ))
    ) {
      throw new BadRequestException(
        ErrorConstant.TENANT_MEMBER_MESSAGES.INVALID_DATA,
      );
    }
  }

  private assertRoleVenue(
    role: TenantRole,
    venueId: string | null | undefined,
  ): void {
    if (role === TenantRole.OWNER && venueId) {
      throw new BadRequestException(
        ErrorConstant.TENANT_MEMBER_MESSAGES.INVALID_DATA,
      );
    }
  }
}
