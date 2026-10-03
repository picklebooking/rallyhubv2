import {
  IsBoolean,
  IsDateString,
  IsEmail,
  IsInt,
  IsNumber,
  IsString,
} from 'class-validator';

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
}
