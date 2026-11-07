import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthorizationRepository } from './authorization.repository';
import { AuthorizationService } from './authorization.service';

@Module({
  imports: [PrismaModule],
  providers: [AuthorizationRepository, AuthorizationService],
  exports: [AuthorizationRepository, AuthorizationService],
})
export class AuthorizationModule {}
