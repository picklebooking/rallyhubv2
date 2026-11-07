import { OmitType, PartialType } from '@nestjs/mapped-types';
import { CreateTenantMemberDto } from './create-tenant-member.dto';

export class UpdateTenantMemberDto extends PartialType(
  OmitType(CreateTenantMemberDto, ['email'] as const),
) {}
