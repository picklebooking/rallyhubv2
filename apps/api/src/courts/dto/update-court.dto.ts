import { IsEnum, IsOptional, IsString } from 'class-validator';
import { CourtStatus } from '../../generated/prisma/client';

export class UpdateCourtDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsEnum(CourtStatus)
  status?: CourtStatus;
}
