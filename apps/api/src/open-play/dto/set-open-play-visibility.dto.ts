import { IsBoolean } from 'class-validator';

export class SetOpenPlayVisibilityDto {
  @IsBoolean()
  isPublic!: boolean;
}
