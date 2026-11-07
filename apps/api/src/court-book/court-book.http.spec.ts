import { jest } from '@jest/globals';
import type { INestApplication } from '@nestjs/common';
import type { Server } from 'node:http';
import request from 'supertest';
import { ErrorConstant } from '../constants/error-code.constant';
import { createHttpTestApp } from '../test-support/http-app';
import { HttpFixtures, teardownHttpSuite } from '../test-support/fixtures';
import type { HttpTestSession } from '../test-support/auth-session';
import { createBurstGate } from '../test-support/burst-gate';
import { localSlot } from '../test-support/booking-times';
import { occupiedOverlapWhere } from './court-book.repository';

const describeIfDb = process.env.TEST_DATABASE_URL ? describe : describe.skip;
const HOUR = 3_600_000;
type Court = { venueId: string; courtId: string };
describeIfDb('Court booking HTTP integrity', () => {
  jest.setTimeout(60_000);
  let app: INestApplication;
  let fixtures: HttpFixtures;
  const users: HttpTestSession[] = [];
  const gate = createBurstGate();
  const slot = localSlot('Asia/Manila', 1, 600);
  const post = (
    court: Court,
    user = users[0],
    start = slot,
    duration = 1,
    email = user.email,
  ) =>
    request(app.getHttpServer() as Server)
      .post('/v1/booking/create-booking')
      .set('Cookie', user.cookie)
      .set('X-Venue-Id', court.venueId)
      .send({
        courtId: court.courtId,
        date: start.toISOString(),
        rentDuration: duration,
        isOpenPlay: false,
        email,
      });
  const occupied = (courtId: string) =>
    fixtures.db.courtSchedule.count({
      where: occupiedOverlapWhere(courtId, slot, new Date(+slot + 3 * HOUR)),
    });
  beforeAll(async () => {
    app = await createHttpTestApp((testApp) =>
      testApp.useGlobalInterceptors(gate.interceptor),
    );
    fixtures = new HttpFixtures();
    for (let i = 0; i < 8; i++) users.push(await fixtures.signUp(app));
  });
  afterAll(() => teardownHttpSuite(app, fixtures));

  it('lets exactly one of 8 concurrent overlapping requests from different users win', async () => {
    const court = await fixtures.createBookableCourt();
    // After the real session guard, align entry into the real service. No
    // production dependency or database operation is mocked or delayed.
    gate.arm(users.length);
    let responses: request.Response[];
    try {
      responses = await Promise.all(
        users.map((user, i) => post(court, user, slot, 1 + (i % 2))),
      );
    } finally {
      gate.disarm();
    }
    const statuses = responses.map((response) => response.status);
    console.log('BURST observations', {
      statuses,
      occupied: await occupied(court.courtId),
    });
    expect(statuses.filter((status) => status === 201)).toHaveLength(1);
    for (const response of responses.filter((r) => r.status !== 201)) {
      expect(response.status).toBe(409);
      expect([
        ErrorConstant.BOOKING_MESSAGES.COURT_UNAVAILABLE,
        ErrorConstant.BOOKING_MESSAGES.BUSY,
      ]).toContain((response.body as { message: string }).message);
    }
    expect(await occupied(court.courtId)).toBe(1);
  });

  it('blocks a request on the court lock and rejects it once the holder commits an overlap', async () => {
    const court = await fixtures.createBookableCourt();
    let release!: () => void;
    let signal!: () => void;
    const ready = new Promise<void>((resolve) => {
      signal = resolve;
    });
    const released = new Promise<void>((resolve) => {
      release = resolve;
    });
    let holderPid = -1;
    const holder = fixtures.db.$transaction(
      async (tx) => {
        // Only count requests blocked by THIS holder, not other suites' locks.
        const [backend] = await tx.$queryRaw<{ pid: number }[]>`
          SELECT pg_backend_pid() AS pid
        `;
        holderPid = backend.pid;
        await tx.court.updateMany({
          where: {
            id: court.courtId,
            venueId: court.venueId,
            status: 'ACTIVE',
          },
          data: { updatedAt: new Date() },
        });
        await tx.courtSchedule.create({
          data: {
            courtId: court.courtId,
            venueId: court.venueId,
            bookedDate: slot,
            dateTimeVacant: new Date(+slot + HOUR),
            hoursBooked: 1,
            isVacant: false,
            isActive: true,
            userId: users[0].userId,
            userEmail: users[0].email,
            referenceId: `holder-${court.courtId}`,
          },
        });
        signal();
        await released;
      },
      { maxWait: 5_000, timeout: 30_000 },
    );
    let blocked = false;
    let response: request.Response;
    try {
      await Promise.race([ready, holder]);
      const pending = post(court).then((result) => result);
      try {
        const deadline = Date.now() + 5_000;
        while (Date.now() < deadline) {
          const waiters = await fixtures.db.$queryRaw<{ pid: number }[]>`
            SELECT pid FROM pg_stat_activity
            WHERE datname = current_database() AND wait_event_type = 'Lock'
              AND query LIKE 'UPDATE "public"."Court"%'
              AND ${holderPid}::int = ANY(pg_blocking_pids(pid))
          `;
          if (waiters.length) {
            blocked = true;
            break;
          }
          await new Promise((resolve) => setTimeout(resolve, 50));
        }
      } finally {
        release();
      }
      await holder;
      response = await pending;
    } finally {
      release();
      await holder;
    }
    const observation = {
      blocked,
      status: response.status,
      occupied: await occupied(court.courtId),
    };
    console.log('DETERMINISTIC observations', observation);
    expect(observation).toEqual({ blocked: true, status: 409, occupied: 1 });
  });

  it('allows concurrent bookings on different courts', async () => {
    const courts = await Promise.all([
      fixtures.createBookableCourt(),
      fixtures.createBookableCourt(),
    ]);
    expect(
      (await Promise.all(courts.map((court) => post(court)))).map(
        (r) => r.status,
      ),
    ).toEqual([201, 201]);
  });
  it('allows back-to-back intervals', async () => {
    const court = await fixtures.createBookableCourt();
    const responses = await Promise.all([
      post(court),
      post(court, users[1], new Date(+slot + HOUR)),
    ]);
    expect(responses.map((r) => r.status)).toEqual([201, 201]);
  });
  it('allows a slot with only a vacant cancelled schedule', async () => {
    const court = await fixtures.createBookableCourt();
    await post(court).expect(201);
    await fixtures.db.courtSchedule.updateMany({
      where: { courtId: court.courtId },
      data: { isVacant: true, isActive: false },
    });
    await fixtures.db.courtBooking.updateMany({
      where: { courtId: court.courtId },
      data: { isActive: false },
    });
    await post(court).expect(201);
  });
  it('owns both rows by the caller despite a spoofed email', async () => {
    const court = await fixtures.createBookableCourt();
    await post(court, users[0], slot, 1, users[1].email).expect(201);
    const booking = await fixtures.db.courtBooking.findFirstOrThrow({
      where: { courtId: court.courtId },
    });
    const schedule = await fixtures.db.courtSchedule.findFirstOrThrow({
      where: { courtId: court.courtId },
    });
    console.log('OWNERSHIP observations', {
      caller: users[0].userId,
      spoofed: users[1].userId,
      bookingOwner: booking.userId,
      scheduleOwner: schedule.userId,
    });
    expect([booking, schedule]).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          userId: users[0].userId,
          userEmail: users[0].email,
        }),
      ]),
    );
    for (const row of [booking, schedule])
      expect(row).toMatchObject({
        userId: users[0].userId,
        userEmail: users[0].email,
      });
  });
  it.each([
    'court-MAINTENANCE',
    'court-INACTIVE',
    'venue-SUSPENDED',
    'venue-PENDING',
    'tenant-SUSPENDED',
    'tenant-PENDING',
  ] as const)('rejects unavailable %s', async (state) => {
    const court = await fixtures.createBookableCourt();
    if (state === 'court-MAINTENANCE' || state === 'court-INACTIVE')
      await fixtures.db.court.update({
        where: { id: court.courtId },
        data: {
          status: state === 'court-MAINTENANCE' ? 'MAINTENANCE' : 'INACTIVE',
        },
      });
    else if (state === 'venue-SUSPENDED' || state === 'venue-PENDING')
      await fixtures.db.venue.update({
        where: { id: court.venueId },
        data: { status: state === 'venue-SUSPENDED' ? 'SUSPENDED' : 'PENDING' },
      });
    else
      await fixtures.db.tenant.update({
        where: { id: court.tenantId },
        data: {
          status: state === 'tenant-SUSPENDED' ? 'SUSPENDED' : 'PENDING',
        },
      });
    const response = await post(court);
    console.log('BOOKABILITY observations', { state, status: response.status });
    expect(response.status).toBe(409);
    expect((response.body as { message: string }).message).toBe(
      ErrorConstant.BOOKING_MESSAGES.COURT_NOT_BOOKABLE,
    );
    expect(
      await fixtures.db.courtSchedule.count({
        where: { courtId: court.courtId },
      }),
    ).toBe(0);
    expect(
      await fixtures.db.courtBooking.count({
        where: { courtId: court.courtId },
      }),
    ).toBe(0);
  });
  it('accepts all ACTIVE and leaves existing occupancy intact after a status change', async () => {
    const court = await fixtures.createBookableCourt();
    await post(court).expect(201);
    await fixtures.db.court.update({
      where: { id: court.courtId },
      data: { status: 'MAINTENANCE' },
    });
    expect(
      await fixtures.db.courtBooking.findFirstOrThrow({
        where: { courtId: court.courtId },
      }),
    ).toMatchObject({ isActive: true });
    expect(
      await fixtures.db.courtSchedule.findFirstOrThrow({
        where: { courtId: court.courtId },
      }),
    ).toMatchObject({ isVacant: false });
  });
});
