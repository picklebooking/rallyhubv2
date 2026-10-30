import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { CurrentTenant } from '../common/decorators/current-tenant.decorator';
import { CommonConstants } from '../constants/common.constant';
import { MainRoute } from '../constants/routes.constant';
import {
  ITenantGeneric,
  ITenantMember,
} from '../interface/ITenantMember.interface';
import { CreateTenantMemberDto } from './dto/create-tenant-member.dto';
import { UpdateTenantMemberDto } from './dto/update-tenant-member.dto';
import { TenantMemberService } from './tenant-member.service';

@Controller({
  path: MainRoute.MAIN_ROUTE.TENANT_MEMBER,
  version: MainRoute.API_VERSIONS.VERSION_ONE,
})
export class TenantMemberController {
  /**
   * Constructs the `TenantMemberController` and injects the necessary services.
   *
   * @param {TenantMemberService} tenantMemberService - The service responsible for handling tenant member business logic.
   */
  constructor(private readonly tenantMemberService: TenantMemberService) {}

  /**
   * Creates a new tenant member using the provided data.
   *
   * @param   {CreateTenantMemberDto}                   createTenantMemberDto  The data required to create a new tenant member.
   * @returns {Promise<ITenantMember<ITenantGeneric>>}                         A promise that resolves to the newly created tenant member.
   */
  @Post(MainRoute.SUB_ROUTE.CREATE)
  public async create(
    @CurrentTenant() tenantId: string,
    @Body() createTenantMemberDto: CreateTenantMemberDto,
  ): Promise<ITenantMember<ITenantGeneric>> {
    return await this.tenantMemberService.create(
      tenantId,
      createTenantMemberDto,
    );
  }

  /**
   * Retrieves all tenant members associated with a specific tenant.
   *
   * @param   {string}                                                      tenantId   The unique identifier of the tenant.
   * @returns {Promise<ITenantMember<ITenantGeneric | ITenantGeneric[]>>}              A promise that resolves to the list of tenant members.
   */
  @Get(`${MainRoute.SUB_ROUTE.FIND_ALL}`)
  public async findAll(
    @CurrentTenant() tenantId: string,
  ): Promise<ITenantMember<ITenantGeneric | ITenantGeneric[]>> {
    return await this.tenantMemberService.findAll(tenantId);
  }

  /**
   * Retrieves a specific tenant member by its unique identifier.
   *
   * @param   {string}                                                    id       The unique identifier of the tenant member.
   * @param   {string}                                                    userId   The unique identifier of the tenant member.
   * @returns {Promise<ITenantMember<ITenantGeneric | ITenantGeneric[]>>}          A promise that resolves to the tenant member details.
   */
  @Get(`${MainRoute.SUB_ROUTE.FIND}/:id`)
  public async findOne(
    @CurrentTenant() id: string,
    @Param(MainRoute.ID) userId: string,
  ): Promise<ITenantMember<ITenantGeneric | ITenantGeneric[]>> {
    return await this.tenantMemberService.findOne(id, userId);
  }

  /**
   * Updates an existing tenant member using the provided data.
   *
   * @param   {string}                                      id                      The unique identifier of the tenant member to update.
   * @param   {UpdateTenantMemberDto}                       updateTenantMemberDto   The data containing the tenant member fields to update.
   * @returns {Promise<ITenantMember<ITenantGeneric>>}                              A promise that resolves to the updated tenant member.
   */
  @Patch(
    `${MainRoute.SUB_ROUTE.PATCH}${CommonConstants.SEPARATOR.SLASH}${CommonConstants.SEPARATOR.COLON}${MainRoute.ID}`,
  )
  public async update(
    @Param(MainRoute.ID) id: string,
    @CurrentTenant() tenantId: string,
    @Body() updateTenantMemberDto: UpdateTenantMemberDto,
  ): Promise<ITenantMember<ITenantGeneric>> {
    return await this.tenantMemberService.update(id, tenantId, updateTenantMemberDto);
  }

  /**
   * Removes a tenant member using its unique identifier.
   *
   * @param   {string}                                  id  The unique identifier of the tenant member to remove.
   * @returns {Promise<ITenantMember<ITenantGeneric>>}      A promise that resolves when the tenant member has been removed.
   */
  @Delete(
    `${MainRoute.SUB_ROUTE.DELETE}${CommonConstants.SEPARATOR.SLASH}${CommonConstants.SEPARATOR.COLON}${MainRoute.ID}`,
  )
  public async remove(
    @Param(MainRoute.ID) id: string,
    @CurrentTenant() tenantId: string
  ): Promise<ITenantMember<ITenantGeneric>> {
    return await this.tenantMemberService.remove(id, tenantId);
  }
}
