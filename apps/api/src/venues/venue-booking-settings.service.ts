import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type {
  VenueBookingSettingsResponse,
  WeeklyHours,
} from '@workspace/shared';
import { AuthorizationService } from '../authorization/authorization.service';
import type {
  BookingRules,
  BookingSettingsRecord,
  WeeklyWindows,
} from '../court-book/booking-rules';
import {
  bookingRulesFromRecord,
  formatHhMm,
  parseHhMm,
  validateBookingSettings,
  WEEKDAY_KEYS,
} from '../court-book/booking-rules';
import type { Venue } from '../generated/prisma/client';
import type { PutVenueBookingSettingsDto } from './dto';
import { VenuesRepository } from './venues.repository';
import { VenueBookingSettingsRepository } from './venue-booking-settings.repository';

@Injectable()
export class VenueBookingSettingsService {
  constructor(
    private readonly venues: VenuesRepository,
    private readonly settings: VenueBookingSettingsRepository,
    private readonly authorization: AuthorizationService,
  ) {}

  async get(venueId: string): Promise<VenueBookingSettingsResponse> {
    const venue = await this.requireVenue(venueId);
    return this.toResponse(venue, await this.settings.findByVenueId(venueId));
  }

  async put(
    actorId: string,
    venueId: string,
    dto: PutVenueBookingSettingsDto,
  ): Promise<VenueBookingSettingsResponse> {
    const venue = await this.requireVenue(venueId);
    await this.authorization.assertCanManageVenue(
      actorId,
      venue.tenantId,
      venue.id,
    );
    const weeklyWindows = Object.fromEntries(
      WEEKDAY_KEYS.map((day) => {
        const hours = dto.weeklyHours[day];
        if (hours === null) return [day, null];
        // DTO validation guarantees both times match HH:mm before this conversion.
        return [
          day,
          {
            opensAtMinute: parseHhMm(hours.opensAt)!,
            closesAtMinute: parseHhMm(hours.closesAt)!,
          },
        ];
      }),
    ) as WeeklyWindows;
    const { minDurationHours, maxDurationHours, horizonDays, startAlignment } =
      dto;
    const rules: BookingRules = {
      minDurationHours,
      maxDurationHours,
      horizonDays,
      startAlignment,
      weeklyWindows,
    };
    const error = validateBookingSettings(rules);
    if (error !== null) throw new BadRequestException(error);
    return this.toResponse(venue, await this.settings.replace(venueId, rules));
  }

  async remove(actorId: string, venueId: string): Promise<void> {
    const venue = await this.requireVenue(venueId);
    await this.authorization.assertCanManageVenue(
      actorId,
      venue.tenantId,
      venue.id,
    );
    await this.settings.deleteByVenueId(venueId);
  }

  private async requireVenue(venueId: string): Promise<Venue> {
    const venue = await this.venues.findById(venueId);
    if (!venue)
      throw new NotFoundException(`Venue with id "${venueId}" not found`);
    return venue;
  }

  private toResponse(
    venue: Venue,
    record: BookingSettingsRecord | null,
  ): VenueBookingSettingsResponse {
    const {
      weeklyWindows,
      minDurationHours,
      maxDurationHours,
      horizonDays,
      startAlignment,
    } = bookingRulesFromRecord(record);
    const weeklyHours = Object.fromEntries(
      WEEKDAY_KEYS.map((day) => {
        const window = weeklyWindows[day];
        return [
          day,
          window === null
            ? null
            : {
                opensAt: formatHhMm(window.opensAtMinute),
                closesAt: formatHhMm(window.closesAtMinute),
              },
        ];
      }),
    ) as WeeklyHours;
    return {
      venueId: venue.id,
      timezone: venue.timezone,
      isDefault: record === null,
      minDurationHours,
      maxDurationHours,
      horizonDays,
      startAlignment,
      weeklyHours,
    };
  }
}
