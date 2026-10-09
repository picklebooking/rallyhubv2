import { IsBoolean, IsInt, IsOptional, Max, Min } from 'class-validator';
import { MAX_OPEN_PLAY_CAPACITY } from '../open-play.rules';

export class EnableOpenPlayDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(MAX_OPEN_PLAY_CAPACITY)
  capacity?: number;

  @IsOptional()
  @IsBoolean()
  isPublic?: boolean;
}
