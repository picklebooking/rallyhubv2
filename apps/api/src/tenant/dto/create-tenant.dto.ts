import { IsEmail, IsOptional, IsString } from 'class-validator';

export class CreateTenantDto {
  @IsEmail()
  email!: string;

  @IsString()
  tenantName!: string;

  @IsString()
  phone!: string;

  @IsOptional()
  @IsString()
  tenantOwnerName?: string;

  @IsOptional()
  @IsString()
  primaryColor?: string;
}
