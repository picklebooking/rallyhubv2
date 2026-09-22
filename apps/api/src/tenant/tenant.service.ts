import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CommonConstants } from '../constants/common.constant';
import { ErrorConstant } from '../constants/error-code.constant';
import { TenantStatus } from '../generated/prisma/enums';
import { ITenant } from '../interface/ITenant.interface';
import { TenantResponse } from '../models/tenant.model';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { UpdateTenantStatusDto } from './dto/update-tenant-status.dto';
import { TenantRepository } from './tenant.repository';

@Injectable()
export class TenantService {
  /**
   * Constructs and injects the needed services.
   *
   * @param {TenantRepository} tenantRepository  The service responsible for the tenant's database transaction.
   */
  constructor(private readonly tenantRepository: TenantRepository) {}

  /**
   * Creates the tenant.
   *
   * @param    {CreateTenantDto}                   payload The payload containing what to insert in the database.
   * @returns  {Promise<TenantResponse<unknown>>}          An object containing the response when creating a tenant.
   */
  public async createTenant(
    payload: CreateTenantDto,
  ): Promise<TenantResponse<unknown>> {
    const { email, tenantName, phone, primaryColor, tenantOwnerName } = payload;

    try {
      await this.tenantRepository.insert(
        email,
        tenantName,
        phone,
        primaryColor,
        tenantOwnerName,
      );

      return new TenantResponse(
        true,
        ErrorConstant.TENANT_MESSAGES.CREATED,
        ErrorConstant.STATUS_CODES.SUCCESS,
      );
    } catch {
      return new TenantResponse(
        false,
        ErrorConstant.HTTP_STATUS_MESSAGES[500],
        ErrorConstant.STATUS_CODES.SERVER_ERROR,
      );
    }
  }

  /**
   * Finds the tenant by id.
   *
   * @param    {string}                                      tenantId        The unique tenant id.
   * @param    {UpdateTenantStatusDto}                       payload         A payload from the client.
   * @param    {boolean}                                     isWithinService A flag that identifies if the method is used within and not by the endpoint.
   * @returns  {Promise<ITenant | TenantResponse<ITenant>>}                  An object containing the found tenant.
   */
  public async findTenantById(
    tenantId: string,
    payload: UpdateTenantStatusDto,
    isWithinService?: boolean,
  ): Promise<ITenant | TenantResponse<ITenant>> {
    const status = payload.status as TenantStatus;
    const foundTenant = await this.tenantRepository.findById(tenantId, status);

    if (!foundTenant || !Object.keys(foundTenant).length) {
      throw new NotFoundException(ErrorConstant.TENANT_MESSAGES.NOT_FOUND);
    }

    if (!isWithinService) {
      return new TenantResponse<ITenant>(
        true,
        CommonConstants.SEPARATOR.EMPTY_STRING,
        ErrorConstant.STATUS_CODES.SUCCESS,
        foundTenant,
      );
    } else {
      return foundTenant;
    }
  }

  /**
   * Deletes the tenant by id.
   *
   * @param    {string}                           tenantId  The unique tenant id.
   * @returns  {Promise<TenantResponse<ITenant>>}           An object containing the response whether the soft-deletion was successful or not.
   */
  public async deteteTenantById(
    tenantId: string,
  ): Promise<TenantResponse<ITenant>> {
    const foundTenant = (await this.findTenantById(
      tenantId,
      {},
      true,
    )) as ITenant;

    if (TenantStatus.INACTIVE === foundTenant.status) {
      throw new BadRequestException(
        ErrorConstant.TENANT_MESSAGES.ALREADY_DELETED,
      );
    }

    const deleted = await this.tenantRepository.delete(tenantId);

    return new TenantResponse<ITenant>(
      true,
      CommonConstants.SEPARATOR.EMPTY_STRING,
      ErrorConstant.STATUS_CODES.SUCCESS,
      deleted,
    );
  }

  /**
   * Updates the tenant's status.
   *
   * @param    {string}                              tenantId The unique tenant id.
   * @param    {UpdateTenantStatusDto}               payload  A payload from the client.
   * @returns  {Promise<TenantResponse<ITenant>>}             An object containing the updated tenant data.
   */
  public async updateTenantStatus(
    tenantId: string,
    payload: UpdateTenantStatusDto,
  ): Promise<TenantResponse<ITenant>> {
    const status = payload.status as TenantStatus;

    await this.findTenantById(tenantId, {}, true);

    const updateStatus = await this.tenantRepository.updateStatus(
      tenantId,
      status,
    );

    return new TenantResponse<ITenant>(
      true,
      ErrorConstant.TENANT_MESSAGES.UPDATED,
      ErrorConstant.STATUS_CODES.SUCCESS,
      updateStatus,
    );
  }

  /**
   * Updates the tenant data.
   *
   * @param    {string}                              tenantId The unique tenant id.
   * @param    {UpdateTenantStatusDto}               payload  A payload from the client.
   * @returns  {Promise<TenantResponse<ITenant>>}             An object containing the updated tenant data.
   */
  public async updateTenantData(
    tenantId: string,
    payload: CreateTenantDto,
  ): Promise<TenantResponse<ITenant>> {
    const { email, tenantName, phone, primaryColor, tenantOwnerName } = payload;

    await this.findTenantById(tenantId, { status: TenantStatus.ACTIVE }, true);

    const updateTenant = await this.tenantRepository.updateTenant(
      tenantId,
      email,
      tenantName,
      phone,
      primaryColor,
      tenantOwnerName,
    );

    return new TenantResponse<ITenant>(
      true,
      ErrorConstant.TENANT_MESSAGES.UPDATED,
      ErrorConstant.STATUS_CODES.SUCCESS,
      updateTenant,
    );
  }
}
