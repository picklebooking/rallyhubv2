import { Module } from '@nestjs/common';
import { AuthorizationModule } from '../authorization/authorization.module';
import { TenantMemberController } from './tenant-member.controller';
import { TenantMemberRepository } from './tenant-member.repository';
import { TenantMemberService } from './tenant-member.service';

@Module({
  imports: [AuthorizationModule],
  controllers: [TenantMemberController],
  providers: [TenantMemberService, TenantMemberRepository],
})
export class TenantMemberModule {}
