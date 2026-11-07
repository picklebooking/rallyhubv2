import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { Session, type UserSession } from '@thallesp/nestjs-better-auth';
import { CommonConstants } from '../constants/common.constant';
import { MainRoute } from '../constants/routes.constant';
import { ITenant } from '../interface/ITenant.interface';
import { TenantResponse } from '../models/tenant.model';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { UpdateTenantStatusDto } from './dto/update-tenant-status.dto';
import { TenantService } from './tenant.service';
import { PatchTenantDto } from './dto/patch-tenant.dto';
import { FindTenantQueryDto } from './dto/find-tenant-query.dto';

@Controller({
  path: MainRoute.MAIN_ROUTE.TENANT,
  version: MainRoute.API_VERSIONS.VERSION_ONE,
})
export class TenantController {
  /**
   * Injects the needed services.
   *
   * @param  {TenantService} tenantService  The service responsible for Tenant related logic.
   */
  constructor(private readonly tenantService: TenantService) {}

  @Post(MainRoute.SUB_ROUTE.CREATE)
  /**
   * Creates the tenant route.
   *
   * @param    {CreateTenantDto}   payload          The payload to be posted in the database.
   * @returns  {Promise<TenantResponse<unknown>>}   The object containing the success or failed object.
   */
  public async createTenantRoute(
    @Session() session: UserSession,
    @Body() payload: CreateTenantDto,
  ): Promise<TenantResponse<unknown>> {
    return await this.tenantService.createTenant(session.user.id, payload);
  }

  @Get(
    `${MainRoute.SUB_ROUTE.FIND}${CommonConstants.SEPARATOR.SLASH}${CommonConstants.SEPARATOR.COLON}${MainRoute.ID}${CommonConstants.SEPARATOR.SLASH}`,
  )
  /**
   * Finds tenant by id.
   *
   * @param    {string}                                     param    The id to be matched.
   * @param    {FindTenantQueryDto}                         query    Optional `TenantStatus` filter.
   * @returns  {Promise<TenantResponse<ITenant>>}                    The object containing the success or failed object.
   */
  public async findTenantByIdRoute(
    @Session() session: UserSession,
    @Param(MainRoute.ID) param: string,
    @Query() query: FindTenantQueryDto,
  ): Promise<TenantResponse<ITenant>> {
    return await this.tenantService.readTenantById(
      session.user.id,
      param,
      query.status,
    );
  }

  @Delete(
    `${MainRoute.SUB_ROUTE.DELETE}${CommonConstants.SEPARATOR.SLASH}${CommonConstants.SEPARATOR.COLON}${MainRoute.ID}`,
  )
  /**
   * Deletes the tenant by id.
   *
   * @param   {string}                            param  The parameter containing the value of id.
   * @returns {Promise<TenantResponse<ITenant>>}         The object containing the success or failed object.
   */
  public async deleteTenantByIdRoute(
    @Session() session: UserSession,
    @Param(MainRoute.ID) param: string,
  ): Promise<TenantResponse<ITenant>> {
    return await this.tenantService.deleteTenantById(session.user.id, param);
  }

  @Patch(
    `${MainRoute.SUB_ROUTE.PATCH}${CommonConstants.SEPARATOR.SLASH}${CommonConstants.SEPARATOR.COLON}${MainRoute.ID}${CommonConstants.SEPARATOR.SLASH}${MainRoute.STATUS}`,
  )
  /**
   * Updates the tenant status.
   *
   * @param    {string}                            param    The id to be matched.
   * @param    {updateTenantStatusDto}             payload  The object that contains the new data to be updated to the database.
   * @returns  {Promise<TenantResponse<ITenant>>}           The object containing the success or failed object.
   */
  public async updateTenantStatusRoute(
    @Session() session: UserSession,
    @Param(MainRoute.ID) param: string,
    @Body() payload: UpdateTenantStatusDto,
  ): Promise<TenantResponse<ITenant>> {
    return await this.tenantService.updateTenantStatus(
      session.user.id,
      param,
      payload,
    );
  }

  @Patch(
    `${MainRoute.SUB_ROUTE.PATCH}${CommonConstants.SEPARATOR.SLASH}${CommonConstants.SEPARATOR.COLON}${MainRoute.ID}`,
  )
  /**
   * Updates the tenant data.
   *
   * @param    {string}                            param    The id to be matched.
   * @param    {PatchTenantDto}                    payload  The object that contains the new data to be updated to the database.
   * @returns  {Promise<TenantResponse<ITenant>>}           The object containing the success or failed object.
   */
  public async updateTenantDataRoute(
    @Session() session: UserSession,
    @Param(MainRoute.ID) param: string,
    @Body() payload: PatchTenantDto,
  ): Promise<TenantResponse<ITenant>> {
    return await this.tenantService.updateTenantData(
      session.user.id,
      param,
      payload,
    );
  }
}
