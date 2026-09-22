import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { CommonConstants } from '../constants/common.constant';
import { MainRoute } from '../constants/routes.constant';
import { ITenant } from '../interface/ITenant.interface';
import { TenantResponse } from '../models/tenant.model';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { UpdateTenantStatusDto } from './dto/update-tenant-status.dto';
import { TenantService } from './tenant.service';

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
    @Body() payload: CreateTenantDto,
  ): Promise<TenantResponse<unknown>> {
    return await this.tenantService.createTenant(payload);
  }

  @Get(
    `${MainRoute.SUB_ROUTE.FIND}${CommonConstants.SEPARATOR.SLASH}${CommonConstants.SEPARATOR.COLON}${MainRoute.ID}${CommonConstants.SEPARATOR.SLASH}${MainRoute.STATUS}`,
  )
  /**
   * Finds tenant by id.
   *
   * @param    {string}                                     param    The id to be matched.
   * @param    {updateTenantStatusDto}                      payload  Contains the object that determines the searching of tenant based on `TenantStatus`.
   * @returns  {Promise<Tenant | TenantResponse<ITenant>>}           The object containing the success or failed object.
   */
  public async findTenantByIdRoute(
    @Param(MainRoute.ID) param: string,
    @Body() payload: UpdateTenantStatusDto,
  ): Promise<ITenant | TenantResponse<ITenant>> {
    return await this.tenantService.findTenantById(param, payload);
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
    @Param(MainRoute.ID) param: string,
  ): Promise<TenantResponse<ITenant>> {
    return await this.tenantService.deteteTenantById(param);
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
    @Param(MainRoute.ID) param: string,
    @Body() payload: UpdateTenantStatusDto,
  ): Promise<TenantResponse<ITenant>> {
    return await this.tenantService.updateTenantStatus(param, payload);
  }

  @Patch(
    `${MainRoute.SUB_ROUTE.PATCH}${CommonConstants.SEPARATOR.SLASH}${CommonConstants.SEPARATOR.COLON}${MainRoute.ID}`,
  )
  /**
   * Updates the tenant data.
   *
   * @param    {string}                            param    The id to be matched.
   * @param    {CreateTenantDto}                   payload  The object that contains the new data to be updated to the database.
   * @returns  {Promise<TenantResponse<ITenant>>}           The object containing the success or failed object.
   */
  public async updateTenantDataRoute(
    @Param(MainRoute.ID) param: string,
    @Body() payload: CreateTenantDto,
  ): Promise<TenantResponse<ITenant>> {
    return await this.tenantService.updateTenantData(param, payload);
  }
}
