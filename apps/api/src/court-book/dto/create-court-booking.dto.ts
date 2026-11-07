import {
  IsBoolean,
  IsISO8601,
  IsInt,
  Matches,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { MAX_BOOKING_DURATION_HOURS } from '../booking-rules';
import { MAX_OPEN_PLAY_CAPACITY } from '../../open-play/open-play.rules';

export const COMPLETE_INSTANT_PATTERN =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?(Z|[+-]\d{2}:\d{2})$/;

export class CreateCourtBookingDto {
  @IsISO8601({ strict: true })
  @Matches(COMPLETE_INSTANT_PATTERN)
  date!: string;

  @IsString()
  courtId!: string;

  @IsInt()
  @Min(1)
  @Max(MAX_BOOKING_DURATION_HOURS)
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
