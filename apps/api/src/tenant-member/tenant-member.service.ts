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
import { TenantRepository } from '../tenant/tenant.repository';
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
    private readonly tenantRepository: TenantRepository,
  ) {}

  public async create(
    tenantId: string,
    actor: TenantMemberActor,
    dto: CreateTenantMemberDto,
  ): Promise<ITenantMember<ITenantGeneric>> {
    await this.assertCanManage(tenantId, actor, dto);

    const { email, role, venueId } = dto;
    this.assertRoleVenue(role, venueId);
    await this.assertVenueBelongsToTenant(tenantId, venueId);

    const { existingUser, tenantMembers } =
      await this.tenantMemberRepository.getValidMember(email, tenantId);
    const user = existingUser[0];
    if (!user) {
      throw new NotFoundException(
        ErrorConstant.TENANT_MEMBER_MESSAGES.NOT_FOUND,
      );
    }

    if (tenantMembers.some((member) => member.venueId === (venueId ?? null))) {
      throw new ConflictException(
        ErrorConstant.TENANT_MEMBER_MESSAGES.ALREADY_EXISTS,
      );
    }

    const inactive = await this.tenantMemberRepository.findInactive(
      user.id,
      tenantId,
      venueId,
    );
    if (inactive) {
      const member = await this.tenantMemberRepository.reactivate(
        inactive.id,
        tenantId,
        role,
        venueId,
      );
      return {
        message: ErrorConstant.TENANT_MEMBER_MESSAGES.REACTIVATE,
        content: member,
      };
    }

    const tenant = await this.tenantRepository.findById(tenantId);
    if (!tenant) {
      throw new NotFoundException(
        ErrorConstant.TENANT_MEMBER_MESSAGES.TENANT_NOT_FOUND,
      );
    }

    const member = await this.tenantMemberRepository.create(
      user.id,
      role,
      tenantId,
      venueId,
    );
    return {
      message: ErrorConstant.TENANT_MEMBER_MESSAGES.CREATED,
      content: member,
    };
  }

  public async findAll(
    tenantId: string,
    actor: TenantMemberActor,
  ): Promise<ITenantMember<ITenantGeneric[]>> {
    await this.assertCanManage(tenantId, actor);
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
    await this.assertCanManage(tenantId, actor);
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
    await this.assertCanManage(tenantId, actor);
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
    await this.assertCanManage(tenantId, actor);
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

  private async assertCanManage(
    tenantId: string,
    actor: TenantMemberActor,
    bootstrap?: CreateTenantMemberDto,
  ): Promise<void> {
    if (await this.tenantMemberRepository.hasActiveOwner(tenantId, actor.id)) {
      return;
    }

    // A verified tenant contact can claim an empty tenant as its first owner.
    if (
      bootstrap?.role === TenantRole.OWNER &&
      !bootstrap.venueId &&
      actor.emailVerified &&
      bootstrap.email.toLowerCase() === actor.email.toLowerCase()
    ) {
      const tenant = await this.tenantRepository.findById(tenantId);
      if (!tenant) {
        throw new NotFoundException(
          ErrorConstant.TENANT_MEMBER_MESSAGES.TENANT_NOT_FOUND,
        );
      }
      if (
        tenant.email?.toLowerCase() === actor.email.toLowerCase() &&
        !(await this.tenantMemberRepository.hasAnyMember(tenantId))
      ) {
        return;
      }
    }

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
