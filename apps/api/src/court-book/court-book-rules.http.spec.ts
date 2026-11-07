import { jest } from '@jest/globals';
import type { INestApplication } from '@nestjs/common';
import type { Server } from 'node:http';
import request from 'supertest';
import { ErrorConstant } from '../constants/error-code.constant';
import { createHttpTestApp } from '../test-support/http-app';
import { HttpFixtures, teardownHttpSuite } from '../test-support/fixtures';
import type { HttpTestSession } from '../test-support/auth-session';
import { localSlot, nextLocalWeekday } from '../test-support/booking-times';
import type { BookingRuleViolation } from './booking-rules';

const describeIfDb = process.env.TEST_DATABASE_URL ? describe : describe.skip;
const TZ = 'Asia/Manila';
const HOUR = 3_600_000;
type Court = { venueId: string; courtId: string };
describeIfDb('Court booking venue rules HTTP', () => {
  jest.setTimeout(60_000);
  let app: INestApplication;
  let fixtures: HttpFixtures;
  let caller: HttpTestSession;
  beforeAll(async () => {
    app = await createHttpTestApp();
    fixtures = new HttpFixtures();
    caller = await fixtures.signUp(app);
  });
  afterAll(() => teardownHttpSuite(app, fixtures));
  const post = (
    court: Court,
    start: Date | string,
    rentDuration = 1,
    isOpenPlay = false,
  ) =>
    request(app.getHttpServer() as Server)
      .post('/v1/booking/create-booking')
      .set('Cookie', caller.cookie)
      .set('X-Venue-Id', court.venueId)
      .send({
        courtId: court.courtId,
        date: typeof start === 'string' ? start : start.toISOString(),
        rentDuration,
        isOpenPlay,
      });
  async function reject(
    court: Court,
    start: Date | string,
    duration: number,
    code?: BookingRuleViolation,
    isOpenPlay = false,
    status = 400,
  ): Promise<void> {
    const before = await fixtures.db.court.findUniqueOrThrow({
      where: { id: court.courtId },
    });
    const response = await post(court, start, duration, isOpenPlay);
    // Check all effects even on the RED run where acceptance is wrong.
    const effects = {
      schedules: await fixtures.db.courtSchedule.count({
        where: { courtId: court.courtId },
      }),
      bookings: await fixtures.db.courtBooking.count({
        where: { courtId: court.courtId },
      }),
      seats: await fixtures.db.openPlaySeat.count({
        where: { booking: { courtId: court.courtId } },
      }),
      updatedAt: (
        await fixtures.db.court.findUniqueOrThrow({
          where: { id: court.courtId },
        })
      ).updatedAt,
    };
    expect({ status: response.status, ...effects }).toEqual({
      status,
      schedules: 0,
      bookings: 0,
      seats: 0,
      updatedAt: before.updatedAt,
    });
    if (code)
      expect((response.body as { message: string }).message).toBe(
        ErrorConstant.BOOKING_MESSAGES[code],
      );
    if (status === 409)
      expect((response.body as { message: string }).message).toBe(
        ErrorConstant.BOOKING_MESSAGES.COURT_NOT_BOOKABLE,
      );
  }
  it.each([
    [300, 1, 'OUTSIDE_OPENING_HOURS'],
    [1380, 2, 'OUTSIDE_OPENING_HOURS'],
    [600, 9, 'DURATION_OUT_OF_RANGE'],
    [630, 1, 'NOT_SLOT_ALIGNED'],
  ] as const)(
    'rejects default slot minute %s duration %s',
    async (minute, duration, code) => {
      await reject(
        await fixtures.createBookableCourt(),
        localSlot(TZ, 1, minute),
        duration,
        code,
      );
    },
  );
  it('accepts a booking ending exactly at default midnight', async () => {
    await post(
      await fixtures.createBookableCourt(),
      localSlot(TZ, 1, 1380),
    ).expect(201);
  });
  it('rejects a start 61 days ahead', async () => {
    await reject(
      await fixtures.createBookableCourt(),
      localSlot(TZ, 61, 600),
      1,
      'BEYOND_HORIZON',
    );
  });
  async function configured(): Promise<Court> {
    const court = await fixtures.createBookableCourt();
    await fixtures.setBookingSettings(court.venueId, {
      minDurationHours: 1,
      maxDurationHours: 3,
      horizonDays: 7,
      startAlignment: 'HALF_HOUR',
      hours: [{ weekday: 'SATURDAY', opensAtMinute: 360, closesAtMinute: 180 }],
    });
    return court;
  }
  it.each([
    ['sunday', 90],
    ['saturday', 630],
  ] as const)(
    'accepts configured %s at %s including Saturday spill',
    async (day, minute) => {
      // No product minimum lead time: use the next future slot to stay within 7 elapsed days.
      await post(
        await configured(),
        nextLocalWeekday(TZ, day, minute, 0),
      ).expect(201);
    },
  );
  it('rejects configured duration beyond maximum', async () => {
    await reject(
      await configured(),
      nextLocalWeekday(TZ, 'saturday', 600, 0),
      4,
      'DURATION_OUT_OF_RANGE',
    );
  });
  it('rejects a configured Saturday at least eight days ahead', async () => {
    await reject(
      await configured(),
      nextLocalWeekday(TZ, 'saturday', 600, 8 * 24 * HOUR),
      1,
      'BEYOND_HORIZON',
    );
  });
  it('treats settings with no hours as closed every day', async () => {
    const court = await fixtures.createBookableCourt();
    await fixtures.setBookingSettings(court.venueId, {
      minDurationHours: 1,
      maxDurationHours: 8,
      horizonDays: 60,
      startAlignment: 'HOUR',
      hours: [],
    });
    await reject(court, localSlot(TZ, 1, 600), 1, 'OUTSIDE_OPENING_HOURS');
  });
  it('rejects a past instant and rolls the entire transaction back', async () => {
    await reject(
      await fixtures.createBookableCourt(),
      new Date(Date.now() - HOUR),
      1,
      'START_IN_PAST',
    );
  });
  it.each([0, -1])('rejects duration %s without writes', async (duration) => {
    await reject(
      await fixtures.createBookableCourt(),
      localSlot(TZ, 1, 600),
      duration,
    );
  });
  it('rejects date-only input', async () => {
    await reject(
      await fixtures.createBookableCourt(),
      localSlot(TZ, 1, 600).toISOString().slice(0, 10),
      1,
    );
  });
  it('stores an offset instant equivalently to Z, evaluating the venue zone', async () => {
    const court = await fixtures.createBookableCourt({
      timezone: 'Asia/Kolkata',
    });
    const instant = localSlot(TZ, 1, 600);
    // 10:00 +08 is 07:30 Kolkata; half-hour rules must use Kolkata's local clock.
    await fixtures.setBookingSettings(court.venueId, {
      minDurationHours: 1,
      maxDurationHours: 8,
      horizonDays: 60,
      startAlignment: 'HALF_HOUR',
      hours: [
        'MONDAY',
        'TUESDAY',
        'WEDNESDAY',
        'THURSDAY',
        'FRIDAY',
        'SATURDAY',
        'SUNDAY',
      ].map((weekday) => ({
        weekday: weekday as Uppercase<import('./booking-rules').WeekdayKey>,
        opensAtMinute: 450,
        closesAtMinute: 540,
      })),
    });
    const date = new Date(+instant + 8 * HOUR)
      .toISOString()
      .replace('Z', '+08:00');
    await post(court, date).expect(201);
    const booking = await fixtures.db.courtBooking.findFirstOrThrow({
      where: { courtId: court.courtId },
    });
    expect(booking.bookDate).toEqual(instant);
    expect(booking.bookDate).toEqual(new Date(date));
  });
  it('fails closed on a legacy invalid stored timezone', async () => {
    const court = await fixtures.createBookableCourt();
    await fixtures.db.venue.update({
      where: { id: court.venueId },
      data: { timezone: 'Not/AZone' },
    });
    await reject(court, localSlot(TZ, 1, 600), 1, undefined, false, 409);
  });
  it('hosts valid Open Play with exactly one booker seat', async () => {
    const court = await fixtures.createBookableCourt();
    await post(court, localSlot(TZ, 1, 600), 1, true).expect(201);
    const seats = await fixtures.db.openPlaySeat.findMany({
      where: { booking: { courtId: court.courtId } },
    });
    expect(seats).toHaveLength(1);
    expect(seats[0]).toMatchObject({ userId: caller.userId, isBooker: true });
  });
  it('rejects Open Play outside hours with no booking or seat', async () => {
    await reject(
      await fixtures.createBookableCourt(),
      localSlot(TZ, 1, 300),
      1,
      'OUTSIDE_OPENING_HOURS',
      true,
    );
  });
});
