import { Injectable } from '@nestjs/common';
import { TenantStatus } from '../generated/prisma/enums';
import { ITenant } from '../interface/ITenant.interface';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class TenantRepository {
  /**
   * Injects the needed services.
   * 
   * @param {PrismaService} prismaService The service responsible for interacting with the database.
   */
  constructor(private readonly prismaService: PrismaService) {}

  /**
   * Inserts the given tenant data to the database.
   * 
   * @param    {string}              email            The tenant's email.
   * @param    {string}              tenantName       The tenant name.
   * @param    {string}              phone            The tenant's phone numuber.
   * @param    {string | undefined}  primaryColor     The tenant's primary color.
   * @param    {string | undefined}  tenantOwnerName  The tenant owner name.
   * @returns  {Promise<ITenant>}                     The object containing what was inserted in the database.
   */
  public async insert(
    email: string,
    tenantName: string,
    phone: string,
    primaryColor: string | undefined,
    tenantOwnerName: string | undefined,
  ): Promise<ITenant> {
    return await this.prismaService.db.tenant.create({
      data: {
        email: email,
        name: tenantName,
        phone: phone,
        primaryColor: primaryColor,
        tenantOwnerName: tenantOwnerName,
      },
    });
  }

  /**
   * Finds the tenant based on the ID and its status.
   * 
   * @param    {string}                  tenantId The tenant's unique id.
   * @param    {TenantStatus}            status   An optional paramter that contains the status.
   * @returns  {Promise<ITenant | null>}          The found tenant from the database.
   */
  public async findById(
    tenantId: string,
    status?: TenantStatus,
  ): Promise<ITenant | null> {
    if (!status)
      return await this.prismaService.db.tenant.findUnique({
        where: { id: tenantId },
      });

    return await this.prismaService.db.tenant.findUnique({
      where: { id: tenantId, status: status },
    });
  }

  /**
   * Deletes a tenant.
   * 
   * @param    {string}           tenantId The unique tenant id.
   * @returns  {Promise<ITenant>}          The object containing the soft-deleted tenant in the database.
   */
  public async delete(tenantId: string): Promise<ITenant> {
    return await this.prismaService.db.tenant.update({
      where: { id: tenantId },
      data: {
        status: TenantStatus.INACTIVE,
      },
    });
  }

  /**
   * Updates the status.
   * 
   * @param    {string}            tenantId The unique tenant id.
   * @param    {TenantStatus}      status   The tenant status.
   * @returns  {Promise<ITenant>}           The object containing the updated tenant in the database.
   */
  public async updateStatus(
    tenantId: string,
    status: TenantStatus,
  ): Promise<ITenant> {
    return await this.prismaService.db.tenant.update({
      where: { id: tenantId },
      data: {
        status: status,
      },
    });
  }

  /**
   * Updates the tenant.
   * 
   * @param    {string}              tenantId         The unique tenant id.
   * @param    {string | undefined}  email            The tenant's email.
   * @param    {string | undefined}  tenantName       The tenant name.
   * @param    {string | undefined}  phone            The tenant's phone numuber.
   * @param    {string | undefined}  primaryColor     The tenant's primary color.
   * @param    {string | undefined}  tenantOwnerName  The tenant owner name.
   * @returns  {Promise<ITenant>}                     The object containing what was updated in the database.
   */
  public async updateTenant(
    tenantId: string,
    email: string | undefined,
    tenantName: string | undefined,
    phone: string | undefined,
    primaryColor: string | undefined,
    tenantOwnerName: string | undefined,
  ): Promise<ITenant> {
    return await this.prismaService.db.tenant.update({
      where: { id: tenantId },
      data: {
        email: email,
        name: tenantName ?? 'Tenant',
        phone: phone,
        primaryColor: primaryColor,
        tenantOwnerName: tenantOwnerName,
      },
    });
  }
}
