import { IsNotEmpty, IsString } from 'class-validator';

export class CreateCourtDto {
  @IsString()
  @IsNotEmpty()
  name!: string;
}
