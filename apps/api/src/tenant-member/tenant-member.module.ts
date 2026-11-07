import { Module } from '@nestjs/common';
import { TenantMemberController } from './tenant-member.controller';
import { TenantMemberRepository } from './tenant-member.repository';
import { TenantMemberService } from './tenant-member.service';

@Module({
  controllers: [TenantMemberController],
  providers: [TenantMemberService, TenantMemberRepository],
})
export class TenantMemberModule {}
