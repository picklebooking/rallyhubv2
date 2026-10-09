import {
  IsBoolean,
  IsDateString,
  IsEmail,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { MAX_OPEN_PLAY_CAPACITY } from '../../open-play/open-play.rules';

export class CreateCourtBookingDto {
  @IsDateString()
  date!: string;

  @IsEmail()
  email!: string;

  @IsString()
  courtId!: string;

  @IsInt()
  @IsNumber()
  rentDuration!: number;

  @IsBoolean()
  isOpenPlay!: boolean;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(MAX_OPEN_PLAY_CAPACITY)
  openPlayCapacity?: number;

  @IsOptional()
  @IsBoolean()
  isOpenPlayPublic?: boolean;
}
