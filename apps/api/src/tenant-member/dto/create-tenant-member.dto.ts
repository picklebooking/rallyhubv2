import { IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';
import { TenantRole } from '../../generated/prisma/enums';

export class CreateTenantMemberDto {
  @IsString()
  email!: string;

  @IsString()
  @IsEnum(TenantRole)
  role!: TenantRole;

  @IsString()
  @IsUUID()
  tenantId!: string;

  @IsString()
  @IsOptional()
  venueId?: string;
}
