import { Type } from 'class-transformer';
import {
  IsDefined,
  IsIn,
  IsInt,
  IsObject,
  Matches,
  Max,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import type {
  BookingStartAlignment,
  DayHours,
  WeeklyHours,
  PutVenueBookingSettingsRequest,
} from '@workspace/shared';
import {
  HH_MM_PATTERN,
  MAX_BOOKING_DURATION_HOURS,
  MAX_HORIZON_DAYS,
} from '../../court-book/booking-rules';

export class DayHoursDto implements DayHours {
  @Matches(HH_MM_PATTERN)
  opensAt!: string;

  @Matches(HH_MM_PATTERN)
  closesAt!: string;
}

export class WeeklyHoursDto implements WeeklyHours {
  @ValidateIf((_: unknown, value: unknown) => value !== null)
  @IsDefined()
  @IsObject()
  @ValidateNested()
  @Type(() => DayHoursDto)
  monday!: DayHoursDto | null;

  @ValidateIf((_: unknown, value: unknown) => value !== null)
  @IsDefined()
  @IsObject()
  @ValidateNested()
  @Type(() => DayHoursDto)
  tuesday!: DayHoursDto | null;

  @ValidateIf((_: unknown, value: unknown) => value !== null)
  @IsDefined()
  @IsObject()
  @ValidateNested()
  @Type(() => DayHoursDto)
  wednesday!: DayHoursDto | null;

  @ValidateIf((_: unknown, value: unknown) => value !== null)
  @IsDefined()
  @IsObject()
  @ValidateNested()
  @Type(() => DayHoursDto)
  thursday!: DayHoursDto | null;

  @ValidateIf((_: unknown, value: unknown) => value !== null)
  @IsDefined()
  @IsObject()
  @ValidateNested()
  @Type(() => DayHoursDto)
  friday!: DayHoursDto | null;

  @ValidateIf((_: unknown, value: unknown) => value !== null)
  @IsDefined()
  @IsObject()
  @ValidateNested()
  @Type(() => DayHoursDto)
  saturday!: DayHoursDto | null;

  @ValidateIf((_: unknown, value: unknown) => value !== null)
  @IsDefined()
  @IsObject()
  @ValidateNested()
  @Type(() => DayHoursDto)
  sunday!: DayHoursDto | null;
}

export class PutVenueBookingSettingsDto implements PutVenueBookingSettingsRequest {
  @IsInt()
  @Min(1)
  @Max(MAX_BOOKING_DURATION_HOURS)
  minDurationHours!: number;

  @IsInt()
  @Min(1)
  @Max(MAX_BOOKING_DURATION_HOURS)
  maxDurationHours!: number;

  @IsInt()
  @Min(1)
  @Max(MAX_HORIZON_DAYS)
  horizonDays!: number;

  @IsIn(['HOUR', 'HALF_HOUR'])
  startAlignment!: BookingStartAlignment;

  @IsDefined()
  @IsObject()
  @ValidateNested()
  @Type(() => WeeklyHoursDto)
  weeklyHours!: WeeklyHoursDto;
}
