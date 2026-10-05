import { IsEnum, IsString } from "class-validator";
import { TenantStatus } from "../../generated/prisma/enums";

export class UpdateTenantStatusDto {
    @IsString()
    @IsEnum(TenantStatus)
    status?: TenantStatus;
}