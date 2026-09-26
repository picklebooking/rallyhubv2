import { Module } from '@nestjs/common';
import { VenuesController } from './venues.controller';
import { VenuesRepository } from './venues.repository';
import { VenuesService } from './venues.service';

@Module({
  controllers: [VenuesController],
  providers: [VenuesRepository, VenuesService],
  exports: [VenuesRepository, VenuesService],
})
export class VenuesModule {}
