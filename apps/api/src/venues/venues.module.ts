import { Module } from '@nestjs/common';
import { AuthorizationModule } from '../authorization/authorization.module';
import { VenueBookingSettingsRepository } from './venue-booking-settings.repository';
import { VenueBookingSettingsService } from './venue-booking-settings.service';
import { VenuesController } from './venues.controller';
import { VenuesRepository } from './venues.repository';
import { VenuesService } from './venues.service';

@Module({
  imports: [AuthorizationModule],
  controllers: [VenuesController],
  providers: [
    VenuesRepository,
    VenuesService,
    VenueBookingSettingsRepository,
    VenueBookingSettingsService,
  ],
  exports: [VenuesRepository, VenuesService],
})
export class VenuesModule {}
