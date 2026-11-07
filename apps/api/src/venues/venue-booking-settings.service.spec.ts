import { BadRequestException, NotFoundException } from '@nestjs/common';
import { jest } from '@jest/globals';
import { AuthorizationService } from '../authorization/authorization.service';
import {
  DEFAULT_VENUE_BOOKING_SETTINGS,
  formatHhMm,
  WEEKDAY_KEYS,
  validateBookingSettings,
} from '../court-book/booking-rules';
import { VenuesRepository } from './venues.repository';
import { VenueBookingSettingsRepository } from './venue-booking-settings.repository';
import { VenueBookingSettingsService } from './venue-booking-settings.service';
import { settingsBody } from './venue-booking-settings.test-support';

describe('VenueBookingSettingsService', () => {
  const venues = { findById: jest.fn<VenuesRepository['findById']>() };
  const records = {
    findByVenueId: jest.fn<VenueBookingSettingsRepository['findByVenueId']>(),
    replace: jest.fn<VenueBookingSettingsRepository['replace']>(),
    deleteByVenueId:
      jest.fn<VenueBookingSettingsRepository['deleteByVenueId']>(),
  };
  const auth = {
    assertCanManageVenue:
      jest.fn<AuthorizationService['assertCanManageVenue']>(),
  };
  const service = new VenueBookingSettingsService(
    venues as unknown as VenuesRepository,
    records as unknown as VenueBookingSettingsRepository,
    auth as unknown as AuthorizationService,
  );
  beforeEach(() => {
    jest.resetAllMocks();
    venues.findById.mockResolvedValue({
      id: 'venue',
      tenantId: 'tenant',
      timezone: 'Asia/Manila',
    } as Awaited<ReturnType<VenuesRepository['findById']>>);
    records.findByVenueId.mockResolvedValue(null);
  });
  it('returns the single code defaults without creating rows', async () => {
    const result = await service.get('venue');
    expect(result).toMatchObject({
      isDefault: true,
      minDurationHours: DEFAULT_VENUE_BOOKING_SETTINGS.minDurationHours,
      maxDurationHours: DEFAULT_VENUE_BOOKING_SETTINGS.maxDurationHours,
      horizonDays: DEFAULT_VENUE_BOOKING_SETTINGS.horizonDays,
      startAlignment: DEFAULT_VENUE_BOOKING_SETTINGS.startAlignment,
    });
    for (const day of WEEKDAY_KEYS) {
      const window = DEFAULT_VENUE_BOOKING_SETTINGS.weeklyWindows[day]!;
      expect(result.weeklyHours[day]).toEqual({
        opensAt: formatHhMm(window.opensAtMinute),
        closesAt: formatHhMm(window.closesAtMinute),
      });
    }
    expect(records.replace).not.toHaveBeenCalled();
  });
  it.each(['put', 'remove'] as const)(
    'checks missing venue before authorization for %s',
    async (operation) => {
      venues.findById.mockResolvedValue(null);
      const result =
        operation === 'put'
          ? service.put('actor', 'missing', settingsBody())
          : service.remove('actor', 'missing');
      await expect(result).rejects.toBeInstanceOf(NotFoundException);
      expect(auth.assertCanManageVenue).not.toHaveBeenCalled();
    },
  );
  it('rejects spill overlap with the pure validator message before writing', async () => {
    const body = settingsBody();
    body.weeklyHours.sunday = { opensAt: '02:00', closesAt: '12:00' };
    const message = validateBookingSettings({
      ...DEFAULT_VENUE_BOOKING_SETTINGS,
      weeklyWindows: {
        ...DEFAULT_VENUE_BOOKING_SETTINGS.weeklyWindows,
        saturday: { opensAtMinute: 360, closesAtMinute: 180 },
        sunday: { opensAtMinute: 120, closesAtMinute: 720 },
      },
    });
    await expect(service.put('actor', 'venue', body)).rejects.toThrow(
      new BadRequestException(message!),
    );
    expect(records.replace).not.toHaveBeenCalled();
  });
  it('authorizes deletion using persisted tenant and venue scope', async () => {
    await service.remove('actor', 'venue');
    expect(auth.assertCanManageVenue).toHaveBeenCalledWith(
      'actor',
      'tenant',
      'venue',
    );
    expect(records.deleteByVenueId).toHaveBeenCalledWith('venue');
  });
});
