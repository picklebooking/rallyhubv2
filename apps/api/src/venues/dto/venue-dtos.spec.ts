import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateVenueDto } from './create-venue.dto';
import { UpdateVenueDto } from './update-venue.dto';
import { PutVenueBookingSettingsDto } from './put-venue-booking-settings.dto';
import { settingsBody } from '../venue-booking-settings.test-support';

describe('Venue DTO validation', () => {
  it.each([CreateVenueDto, UpdateVenueDto])(
    'validates timezone in %p',
    async (Dto) => {
      expect(
        await validate(
          plainToInstance<UpdateVenueDto, object>(Dto, {
            name: 'Venue',
            slug: 'venue',
            timezone: 'Mars/Phobos',
          }),
        ),
      ).not.toHaveLength(0);
      expect(
        await validate(
          plainToInstance<UpdateVenueDto, object>(Dto, {
            name: 'Venue',
            slug: 'venue',
            timezone: 'Asia/Kolkata',
          }),
        ),
      ).toHaveLength(0);
    },
  );
  it('accepts valid settings including closed null days', async () => {
    expect(
      await validate(
        plainToInstance(PutVenueBookingSettingsDto, settingsBody()),
      ),
    ).toHaveLength(0);
  });
  it.each([
    { minDurationHours: 0 },
    { minDurationHours: 25 },
    { minDurationHours: 1.5 },
    { maxDurationHours: 0 },
    { maxDurationHours: 25 },
    { maxDurationHours: '2' },
    { horizonDays: 0 },
    { horizonDays: 366 },
    { horizonDays: 1.5 },
    { startAlignment: 'QUARTER' },
    { weeklyHours: undefined },
    { weeklyHours: null },
    { weeklyHours: [] },
    { weeklyHours: [settingsBody().weeklyHours] },
    { weeklyHours: 'bad' },
    { weeklyHours: 1 },
  ])('rejects invalid required scalars or week shape %p', async (changes) => {
    expect(
      await validate(
        plainToInstance(PutVenueBookingSettingsDto, {
          ...settingsBody(),
          ...changes,
        }),
      ),
    ).not.toHaveLength(0);
  });
  it.each(['6:00', '06:15', '24:00', null, 600])(
    'rejects bad day time %p',
    async (opensAt) => {
      const body = settingsBody();
      const weeklyHours = {
        ...body.weeklyHours,
        monday: { opensAt, closesAt: '00:00' },
      };
      expect(
        await validate(
          plainToInstance(PutVenueBookingSettingsDto, { ...body, weeklyHours }),
        ),
      ).not.toHaveLength(0);
    },
  );
  it.each([
    'monday',
    'tuesday',
    'wednesday',
    'thursday',
    'friday',
    'saturday',
    'sunday',
  ] as const)('requires %s even when closed', async (day) => {
    const body = settingsBody();
    delete (body.weeklyHours as Partial<typeof body.weeklyHours>)[day];
    expect(
      await validate(plainToInstance(PutVenueBookingSettingsDto, body)),
    ).not.toHaveLength(0);
  });
  it.each([[], [{ opensAt: '06:00', closesAt: '00:00' }], 'bad', 1, {}])(
    'rejects non-day object %p',
    async (monday) => {
      const body = settingsBody();
      expect(
        await validate(
          plainToInstance(PutVenueBookingSettingsDto, {
            ...body,
            weeklyHours: { ...body.weeklyHours, monday },
          }),
        ),
      ).not.toHaveLength(0);
    },
  );
});
