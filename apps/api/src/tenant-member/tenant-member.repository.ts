import { Injectable } from '@nestjs/common';
import { TenantRole } from '../generated/prisma/enums';
import type { IGenericUsers } from '../interface/IGenericUsers.interface';
import type { ITenantGeneric } from '../interface/ITenantMember.interface';
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
    venueId: string | null | undefined,
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
  public async getValidMember(
    email: string,
    tenantId: string,
  ): Promise<{
    existingUser: IGenericUsers[];
    tenantMembers: ITenantGeneric[];
  }> {
    const [existingUser, tenantMembers] = await Promise.all([
      this.prismaService.db.user.findMany({
        where: { email },
      }),

      this.prismaService.db.tenantMember.findMany({
        where: {
          tenantId,
          isActive: true,
          user: {
            email,
          },
        },
      }),
    ]);

    return { existingUser, tenantMembers };
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

  public async hasAnyMember(tenantId: string): Promise<boolean> {
    const member = await this.prismaService.db.tenantMember.findFirst({
      where: { tenantId },
      select: { id: true },
    });
    return member !== null;
  }

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
    venueId: string | null | undefined,
  ): Promise<ITenantGeneric | null> {
    return await this.prismaService.db.tenantMember.findFirst({
      where: { userId, tenantId, venueId: venueId ?? null, isActive: false },
    });
  }

  /** Reactivates one membership with the requested role and venue. */
  public async reactivate(
    id: string,
    tenantId: string,
    role: TenantRole,
    venueId: string | null | undefined,
  ): Promise<ITenantGeneric> {
    return await this.prismaService.db.tenantMember.update({
      where: { id, tenantId, isActive: false },
      data: {
        isActive: true,
        role,
        venueId,
      },
    });
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

  /**
   * Soft-deletes a Tenant Member.
   *
   * @param    {string}                   id The identifier to soft-delete.
   * @returns  {Promise<ITenantGeneric>}     The deleted tenant member.
   */
  public async delete(id: string, tenantId: string): Promise<ITenantGeneric> {
    return await this.prismaService.db.tenantMember.update({
      where: { id, tenantId, isActive: true },
      data: {
        isActive: false,
      },
    });
  }
}
