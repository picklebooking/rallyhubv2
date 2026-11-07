import { PartialType } from '@nestjs/mapped-types';
import { CreateTenantDto } from './create-tenant.dto';

export class PatchTenantDto extends PartialType(CreateTenantDto) {}
