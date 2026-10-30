import { IsEnum, IsOptional, IsString } from 'class-validator';
import { TenantRole } from '../../generated/prisma/enums';

export class CreateTenantMemberDto {
  @IsString()
  email!: string;

  @IsString()
  @IsEnum(TenantRole)
  role!: TenantRole;

  @IsString()
  @IsOptional()
  venueId?: string;
}
