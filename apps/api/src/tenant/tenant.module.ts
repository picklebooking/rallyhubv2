import { Module } from '@nestjs/common';
import { TenantService } from './tenant.service';
import { TenantController } from './tenant.controller';
import { TenantRepository } from './tenant.repository';
import { PrismaService } from '../prisma/prisma.service';

@Module({
  controllers: [TenantController],
  providers: [TenantService, TenantRepository, PrismaService],
})
export class TenantModule {}
