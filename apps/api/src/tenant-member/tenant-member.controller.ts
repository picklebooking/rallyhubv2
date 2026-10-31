import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { Session, type UserSession } from '@thallesp/nestjs-better-auth';
import { CurrentTenant } from '../common/decorators/current-tenant.decorator';
import { MainRoute } from '../constants/routes.constant';
import type {
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
  constructor(private readonly tenantMemberService: TenantMemberService) {}

  @Post(MainRoute.SUB_ROUTE.CREATE)
  public create(
    @CurrentTenant() tenantId: string,
    @Session() session: UserSession,
    @Body() dto: CreateTenantMemberDto,
  ): Promise<ITenantMember<ITenantGeneric>> {
    return this.tenantMemberService.create(tenantId, session.user, dto);
  }

  @Get(MainRoute.SUB_ROUTE.FIND_ALL)
  public findAll(
    @CurrentTenant() tenantId: string,
    @Session() session: UserSession,
  ): Promise<ITenantMember<ITenantGeneric[]>> {
    return this.tenantMemberService.findAll(tenantId, session.user);
  }

  @Get(`${MainRoute.SUB_ROUTE.FIND}/:id`)
  public findOne(
    @CurrentTenant() tenantId: string,
    @Param(MainRoute.ID) memberId: string,
    @Session() session: UserSession,
  ): Promise<ITenantMember<ITenantGeneric>> {
    return this.tenantMemberService.findOne(tenantId, memberId, session.user);
  }

  @Patch(`${MainRoute.SUB_ROUTE.PATCH}/:id`)
  public update(
    @Param(MainRoute.ID) memberId: string,
    @CurrentTenant() tenantId: string,
    @Session() session: UserSession,
    @Body() dto: UpdateTenantMemberDto,
  ): Promise<ITenantMember<ITenantGeneric>> {
    return this.tenantMemberService.update(
      memberId,
      tenantId,
      session.user,
      dto,
    );
  }

  @Delete(`${MainRoute.SUB_ROUTE.DELETE}/:id`)
  public remove(
    @Param(MainRoute.ID) memberId: string,
    @CurrentTenant() tenantId: string,
    @Session() session: UserSession,
  ): Promise<ITenantMember<ITenantGeneric>> {
    return this.tenantMemberService.remove(memberId, tenantId, session.user);
  }
}
