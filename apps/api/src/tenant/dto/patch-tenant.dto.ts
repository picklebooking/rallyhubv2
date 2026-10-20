import { PartialType } from '@nestjs/mapped-types';
import { IsEmail, IsOptional, IsString } from 'class-validator';
import { CreateTenantDto } from './create-tenant.dto';

export class PatchTenantDto extends PartialType(CreateTenantDto) {}
