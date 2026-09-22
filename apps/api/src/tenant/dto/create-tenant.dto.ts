import { IsEmail, IsString } from 'class-validator';

export class CreateTenantDto {
  @IsEmail()
  email?: string;

  @IsString()
  tenantName?: string;

  @IsString()
  phone?: string;

  @IsString()
  tenantOwnerName?: string;

  @IsString()
  primaryColor?: string;
}
