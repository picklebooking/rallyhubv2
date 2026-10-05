import { IsEmail, IsOptional, IsString } from 'class-validator';

export class PatchTenantDto {
  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  tenantName?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  tenantOwnerName?: string;

  @IsOptional()
  @IsString()
  primaryColor?: string;
}