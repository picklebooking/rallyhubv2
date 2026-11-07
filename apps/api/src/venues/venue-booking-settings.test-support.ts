import type { PutVenueBookingSettingsRequest } from '@workspace/shared';

export function settingsBody(): PutVenueBookingSettingsRequest {
  return {
    minDurationHours: 1,
    maxDurationHours: 3,
    horizonDays: 7,
    startAlignment: 'HALF_HOUR',
    weeklyHours: {
      monday: { opensAt: '06:30', closesAt: '00:00' },
      tuesday: null,
      wednesday: null,
      thursday: null,
      friday: null,
      saturday: { opensAt: '06:00', closesAt: '03:00' },
      sunday: null,
    },
  };
}
