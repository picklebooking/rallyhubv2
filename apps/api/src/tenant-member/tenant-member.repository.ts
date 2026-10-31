import { Injectable } from '@nestjs/common';
import { DefaultArgs, PrismaPromise } from '@prisma/client/runtime/client';
import { CommonConstants } from '../constants/common.constant';
import { TenantRole } from '../generated/prisma/enums';
import {
  BatchPayload,
  GlobalOmitConfig,
  Prisma__TenantMemberClient,
} from '../generated/prisma/internal/prismaNamespace';
import { IGenericUsers } from '../interface/IGenericUsers.interface';
import { ITenantGeneric } from '../interface/ITenantMember.interface';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class TenantMemberRepository {
  /**
   * Constructs the `TenantMemberRepository` and injects needed services.
   *
   * @param {PrismaService} prismaService Service responsible with interacting in the database.
   */
  constructor(private readonly prismaService: PrismaService) {}

  /**
   * Creates a tenant member entry in the database.
   *
   * @param    {TenantRole}               role     The member's role.
   * @param    {string}                   tenantId Identifier which a tenant member belongs to.
   * @param    {string | undefined}       venueId  The identifier which venue a member is assigned.
   * @returns  {Promise<ITenantGeneric>}           Returns a success message with the data inserted in the database.
   */
  public async create(
    userId: string,
    role: TenantRole,
    tenantId: string,
    venueId: string | undefined,
  ): Promise<ITenantGeneric> {
    return await this.prismaService.db.tenantMember.create({
      data: {
        userId: userId,
        role: role,
        tenantId: tenantId,
        venueId: venueId,
      },
    });
  }

  /**
   * Gets the valid member from Tenant Member table based on a valid user.
   *
   * @param    {string}                                                                     email The user's member email.
   * @returns  {Promise<{existingUser: IGenericUsers[], tenantMembers: ITenantGeneric[]}>}
   */
  public async getValidMember(email: string): Promise<{
    existingUser: IGenericUsers[];
    tenantMembers: ITenantGeneric[];
  }> {
    return await this.prismaService.db.$transaction(async (transaction) => {
      const existingUser = await transaction.user.findMany({
        where: { email },
      });

      const tenantMembers = await transaction.tenantMember.findMany({
        where: {
          userId: existingUser[CommonConstants.NUMERIC.ZERO]?.id,
          isActive: true,
        },
      });

      return { existingUser, tenantMembers };
    });
  }

  /**
   * Finds an inactive tenant membership associated with a specific
   * user and tenant.
   *
   * @param   {string}                          userId    The unique identifier of the user.
   * @param   {string}                          tenantId  The unique identifier of the tenant.
   * @returns {Promise<ITenantGeneric | null>}            The inactive tenant
   * membership, or null if no matching record exists.
   */
  public async findInactive(
    userId: string,
    tenantId: string,
  ): Promise<ITenantGeneric | null> {
    return await this.prismaService.db.tenantMember.findFirst({
      where: { userId, tenantId, isActive: false },
    });
  }

  /**
   * Reactivates inactive tenant memberships associated with a
   * specific user and tenant.
   *
   * @param {string}                   userId    The unique identifier of the user.
   * @param {string}                   tenantId  The unique identifier of the tenant.
   * @returns {Promise<BatchPayload>}            The Prisma batch payload
   * containing the number of updated records.
   */
  public async reactivate(
    userId: string,
    tenantId: string,
  ): Promise<BatchPayload> {
    return await this.prismaService.db.tenantMember.updateMany({
      where: { userId, tenantId, isActive: false },
      data: {
        isActive: true,
      },
    });
  }

  /**
   * Gets the tenant member
   *
   * @param   {string}                                                                                                                                             tenantId     The member's identifier.
   * @param   {boolean}                                                                                                                                            isAllTenant  A flag where it determines whether the getter is for all member or for a single member.
   * @returns { | PrismaPromise<ITenantGeneric[]> | Prisma__TenantMemberClient<ITenantGeneric | null, null, DefaultArgs, { omit: GlobalOmitConfig | undefined; }>}
   */
  public getTenantMember(
    tenantId: string,
    userId: string,
    isAllTenant?: boolean,
  ):
    | PrismaPromise<ITenantGeneric[]>
    | Prisma__TenantMemberClient<
        ITenantGeneric | null,
        null,
        DefaultArgs,
        {
          omit: GlobalOmitConfig | undefined;
        }
      > {
    const { tenantMember } = this.prismaService.db;

    if (isAllTenant) {
      return tenantMember.findMany({
        where: { tenantId, isActive: true },
      });
    }

    return tenantMember.findFirst({
      where: {
        tenantId,
        userId,
        isActive: true,
      },
    });
  }

  /**
   * Updates an entry in the Tenant Member table.
   *
   * @param    {string}                     id       The unique id of a tenant member.
   * @param    {TenantRole}                 role     The role to be updated.
   * @param    {string}                     venueId  The venue identifier to be updated where a member assigned to.
   * @returns  {Promise<ITenantGeneric>}             The updated tenant member.
   */
  public async update(
    id: string,
    role?: TenantRole,
    venueId?: string,
  ): Promise<ITenantGeneric> {
    return await this.prismaService.db.tenantMember.update({
      where: { id },
      data: {
        role,
        venueId,
      },
    });
  }

  /**
   * Soft-deletes a Tenant Member.
   *
   * @param    {string}                   id The identifier to soft-delete.
   * @returns  {Promise<ITenantGeneric>}     The deleted tenant member.
   */
  public async delete(id: string): Promise<ITenantGeneric> {
    return await this.prismaService.db.tenantMember.update({
      where: { id },
      data: {
        isActive: false,
      },
    });
  }
}
