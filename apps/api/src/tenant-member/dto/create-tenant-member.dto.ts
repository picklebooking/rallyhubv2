import { IsEmail, IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';
import { TenantRole } from '../../generated/prisma/enums';

export class CreateTenantMemberDto {
  @IsEmail()
  email!: string;

  @IsString()
  @IsEnum(TenantRole)
  role!: TenantRole;

  @IsOptional()
  @IsUUID()
  venueId?: string | null;
}
