import { Module } from '@nestjs/common';
import { AuthorizationModule } from '../authorization/authorization.module';
import { VenuesModule } from '../venues/venues.module';
import { CourtsController } from './courts.controller';
import { CourtsRepository } from './courts.repository';
import { CourtsService } from './courts.service';

@Module({
  imports: [AuthorizationModule, VenuesModule],
  controllers: [CourtsController],
  providers: [CourtsRepository, CourtsService],
  exports: [CourtsRepository, CourtsService],
})
export class CourtsModule {}
