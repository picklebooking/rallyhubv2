import { IsEnum, IsOptional } from 'class-validator';
import { TenantStatus } from '../../generated/prisma/enums';

export class FindTenantQueryDto {
  @IsOptional()
  @IsEnum(TenantStatus)
  status?: TenantStatus;
}
