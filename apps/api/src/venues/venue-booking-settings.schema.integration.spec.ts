import { randomUUID } from 'node:crypto';
import { HttpFixtures, teardownHttpSuite } from '../test-support/fixtures';

const describeIfDb = process.env.TEST_DATABASE_URL ? describe : describe.skip;

describeIfDb(
  'Venue booking settings schema (requires TEST_DATABASE_URL)',
  () => {
    let fixtures: HttpFixtures;

    beforeAll(() => {
      fixtures = new HttpFixtures();
    });

    afterAll(async () => {
      await teardownHttpSuite(undefined, fixtures);
    });

    it('stores one settings row per venue with its hours, and cascades on venue delete', async () => {
      const tenant = await fixtures.createTenant();
      const venue = await fixtures.createVenue(tenant.id);
      await fixtures.setBookingSettings(venue.id, {
        minDurationHours: 1,
        maxDurationHours: 3,
        horizonDays: 7,
        startAlignment: 'HALF_HOUR',
        hours: [
          { weekday: 'MONDAY', opensAtMinute: 360, closesAtMinute: 0 },
          { weekday: 'SATURDAY', opensAtMinute: 360, closesAtMinute: 180 },
        ],
      });
      const settings = await fixtures.db.venueBookingSettings.findUniqueOrThrow(
        {
          where: { venueId: venue.id },
          include: { openingHours: true },
        },
      );
      expect(settings).toMatchObject({
        minDurationHours: 1,
        maxDurationHours: 3,
        horizonDays: 7,
        startAlignment: 'HALF_HOUR',
      });
      expect(settings.openingHours).toHaveLength(2);
      // Replacing the full week must also remove omitted weekdays.
      await fixtures.setBookingSettings(venue.id, {
        minDurationHours: 2,
        maxDurationHours: 4,
        horizonDays: 14,
        startAlignment: 'HOUR',
        hours: [],
      });
      expect(
        await fixtures.db.venueBookingSettings.count({
          where: { venueId: venue.id },
        }),
      ).toBe(1);
      expect(
        await fixtures.db.venueOpeningHours.count({
          where: { settingsId: settings.id },
        }),
      ).toBe(0);
      await fixtures.db.venueOpeningHours.createMany({
        data: [
          {
            settingsId: settings.id,
            weekday: 'MONDAY',
            opensAtMinute: 360,
            closesAtMinute: 0,
          },
          {
            settingsId: settings.id,
            weekday: 'SATURDAY',
            opensAtMinute: 360,
            closesAtMinute: 180,
          },
        ],
      });
      await fixtures.db.venue.delete({ where: { id: venue.id } });
      expect(
        await fixtures.db.venueBookingSettings.count({
          where: { venueId: venue.id },
        }),
      ).toBe(0);
      expect(
        await fixtures.db.venueOpeningHours.count({
          where: { settingsId: settings.id },
        }),
      ).toBe(0);
    });

    it('rejects two hour rows for the same weekday', async () => {
      const { venueId } = await fixtures.createBookableCourt();
      await fixtures.setBookingSettings(venueId, {
        minDurationHours: 1,
        maxDurationHours: 8,
        horizonDays: 60,
        startAlignment: 'HOUR',
        hours: [{ weekday: 'MONDAY', opensAtMinute: 360, closesAtMinute: 0 }],
      });
      const settings = await fixtures.db.venueBookingSettings.findUniqueOrThrow(
        { where: { venueId } },
      );
      await expect(
        fixtures.db.venueOpeningHours.create({
          data: {
            settingsId: settings.id,
            weekday: 'MONDAY',
            opensAtMinute: 480,
            closesAtMinute: 0,
          },
        }),
      ).rejects.toMatchObject({ code: 'P2002' });
    });

    it('rejects a second settings row for the same venue', async () => {
      const { venueId } = await fixtures.createBookableCourt();
      const rules = {
        minDurationHours: 1,
        maxDurationHours: 8,
        horizonDays: 60,
        startAlignment: 'HOUR' as const,
      };
      await fixtures.setBookingSettings(venueId, { ...rules, hours: [] });
      await expect(
        fixtures.db.venueBookingSettings.create({
          data: { venueId, ...rules },
        }),
      ).rejects.toMatchObject({ code: 'P2002' });
    });

    it('cleans up bookings and schedules on tracked courts', async () => {
      const tracked = new HttpFixtures();
      try {
        const { tenantId, venueId, courtId } =
          await tracked.createBookableCourt({ timezone: 'Asia/Kathmandu' });
        expect(
          await tracked.db.tenant.findUnique({ where: { id: tenantId } }),
        ).toMatchObject({ status: 'ACTIVE' });
        expect(
          await tracked.db.venue.findUnique({ where: { id: venueId } }),
        ).toMatchObject({ status: 'ACTIVE', timezone: 'Asia/Kathmandu' });
        expect(
          await tracked.db.court.findUnique({ where: { id: courtId } }),
        ).toMatchObject({ status: 'ACTIVE' });
        const user = await tracked.db.user.create({
          data: {
            name: 'Booking fixture',
            email: `${randomUUID()}@example.com`,
          },
        });
        tracked.trackUser(user.id);
        const referenceId = randomUUID();
        const start = new Date();
        await tracked.db.courtSchedule.create({
          data: {
            courtId,
            venueId,
            userId: user.id,
            userEmail: user.email,
            bookedDate: start,
            dateTimeVacant: new Date(start.getTime() + 3_600_000),
            hoursBooked: 1,
            isVacant: false,
            referenceId,
          },
        });
        const booking = await tracked.db.courtBooking.create({
          data: {
            courtId,
            venueId,
            userId: user.id,
            userEmail: user.email,
            bookDate: start,
            referenceId,
            isOpenPlay: true,
            openPlaySeats: { create: { userId: user.id, isBooker: true } },
          },
        });
        await expect(tracked.cleanup()).resolves.toBeUndefined();
        expect(await fixtures.db.court.count({ where: { id: courtId } })).toBe(
          0,
        );
        expect(
          await fixtures.db.courtBooking.count({ where: { id: booking.id } }),
        ).toBe(0);
        expect(
          await fixtures.db.courtSchedule.count({ where: { courtId } }),
        ).toBe(0);
        expect(
          await fixtures.db.openPlaySeat.count({
            where: { bookingId: booking.id },
          }),
        ).toBe(0);
      } finally {
        await tracked.cleanup();
      }
    });
  },
);
