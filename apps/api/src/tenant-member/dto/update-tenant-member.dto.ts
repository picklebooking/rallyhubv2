import { PartialType } from '@nestjs/mapped-types';
import { CreateTenantMemberDto } from './create-tenant-member.dto';

export class UpdateTenantMemberDto extends PartialType(CreateTenantMemberDto) {}
