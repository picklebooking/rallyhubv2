import { jest } from '@jest/globals';
import type { INestApplication } from '@nestjs/common';
import type { Server } from 'node:http';
import type { VenueBookingSettingsResponse } from '@workspace/shared';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { ErrorConstant } from '../constants/error-code.constant';
import {
  DEFAULT_VENUE_BOOKING_SETTINGS,
  formatHhMm,
  WEEKDAY_KEYS,
} from '../court-book/booking-rules';
import { createHttpTestApp } from '../test-support/http-app';
import type { HttpTestSession } from '../test-support/auth-session';
import { HttpFixtures, teardownHttpSuite } from '../test-support/fixtures';
import { settingsBody } from './venue-booking-settings.test-support';

const describeIfDb = process.env.TEST_DATABASE_URL ? describe : describe.skip;
const roles = [
  'owner',
  'staff',
  'venueStaff',
  'customer',
  'siblingStaff',
  'foreignOwner',
  'inactiveOwner',
  'inactiveStaff',
  'admin',
] as const;
type Role = (typeof roles)[number];

describeIfDb('Venue booking settings HTTP', () => {
  jest.setTimeout(60_000);
  let app: INestApplication;
  let fixtures: HttpFixtures;
  let tenantId: string;
  let venueId: string;
  const actors = {} as Record<Role, HttpTestSession>;
  const path = (id = venueId): string => `/venues/${id}/booking-settings`;
  beforeAll(async () => {
    app = await createHttpTestApp();
    fixtures = new HttpFixtures();
    tenantId = (await fixtures.createTenant()).id;
    venueId = (await fixtures.createVenue(tenantId)).id;
    const sibling = await fixtures.createVenue(tenantId);
    const foreign = await fixtures.createTenant();
    for (const role of roles) actors[role] = await fixtures.signUp(app);
    await fixtures.addMember(actors.owner.userId, tenantId, 'OWNER');
    await fixtures.addMember(actors.staff.userId, tenantId, 'STAFF');
    await fixtures.addMember(
      actors.venueStaff.userId,
      tenantId,
      'STAFF',
      venueId,
    );
    await fixtures.addMember(
      actors.siblingStaff.userId,
      tenantId,
      'STAFF',
      sibling.id,
    );
    await fixtures.addMember(actors.foreignOwner.userId, foreign.id, 'OWNER');
    await fixtures.addMember(
      actors.inactiveOwner.userId,
      tenantId,
      'OWNER',
      null,
      false,
    );
    await fixtures.addMember(
      actors.inactiveStaff.userId,
      tenantId,
      'STAFF',
      null,
      false,
    );
    await fixtures.makePlatformAdmin(actors.admin.userId);
  });
  afterAll(() => teardownHttpSuite(app, fixtures));
  beforeEach(async () => {
    await fixtures.db.venueBookingSettings.deleteMany({ where: { venueId } });
  });
  it('requires a session for reads', async () => {
    expect(
      (await request(app.getHttpServer() as Server).get(path())).status,
    ).toBe(401);
  });
  it('returns effective defaults for customers without persisting them', async () => {
    const response = await request(app.getHttpServer() as Server)
      .get(path())
      .set('Cookie', actors.customer.cookie);
    expect(response.status).toBe(200);
    const rules = DEFAULT_VENUE_BOOKING_SETTINGS;
    expect(response.body).toMatchObject({
      venueId,
      timezone: 'Asia/Manila',
      isDefault: true,
      minDurationHours: rules.minDurationHours,
      maxDurationHours: rules.maxDurationHours,
      horizonDays: rules.horizonDays,
      startAlignment: rules.startAlignment,
    });
    for (const day of WEEKDAY_KEYS) {
      const window = rules.weeklyWindows[day]!;
      expect(
        (response.body as VenueBookingSettingsResponse).weeklyHours[day],
      ).toEqual({
        opensAt: formatHhMm(window.opensAtMinute),
        closesAt: formatHhMm(window.closesAtMinute),
      });
    }
    expect(
      await fixtures.db.venueBookingSettings.count({ where: { venueId } }),
    ).toBe(0);
  });
  it.each(['get', 'put', 'delete'] as const)(
    'returns missing venue 404 before authorization for %s',
    async (verb) => {
      const response = await request(app.getHttpServer() as Server)
        [verb](path(randomUUID()))
        .set('Cookie', actors.customer.cookie)
        .send(verb === 'put' ? settingsBody() : undefined);
      expect(response.status).toBe(404);
    },
  );
  it.each(roles)(
    'uses database scope for %s mutations and preserves forbidden state',
    async (role) => {
      const allowed = ['owner', 'staff', 'venueStaff', 'admin'].includes(role);
      const put = await request(app.getHttpServer() as Server)
        .put(path())
        .set('Cookie', actors[role].cookie)
        .set('X-Tenant-Id', randomUUID())
        .send(settingsBody());
      expect(put.status).toBe(allowed ? 200 : 403);
      if (!allowed) {
        expect((put.body as { message: string }).message).toBe(
          ErrorConstant.AUTHORIZATION_MESSAGES.FORBIDDEN,
        );
        expect(
          await fixtures.db.venueBookingSettings.count({ where: { venueId } }),
        ).toBe(0);
        await fixtures.setBookingSettings(venueId, {
          minDurationHours: 1,
          maxDurationHours: 3,
          horizonDays: 7,
          startAlignment: 'HOUR',
          hours: [{ weekday: 'MONDAY', opensAtMinute: 360, closesAtMinute: 0 }],
        });
      }
      const before = await fixtures.db.venueBookingSettings.findUnique({
        where: { venueId },
        include: { openingHours: true },
      });
      const remove = await request(app.getHttpServer() as Server)
        .delete(path())
        .set('Cookie', actors[role].cookie);
      expect(remove.status).toBe(allowed ? 204 : 403);
      const after = await fixtures.db.venueBookingSettings.findUnique({
        where: { venueId },
        include: { openingHours: true },
      });
      if (allowed) expect(after).toBeNull();
      else {
        expect((remove.body as { message: string }).message).toBe(
          ErrorConstant.AUTHORIZATION_MESSAGES.FORBIDDEN,
        );
        expect(after).toEqual(before);
      }
    },
  );
  it('fully replaces settings, round-trips closed days and resets defaults idempotently on a PENDING venue', async () => {
    expect(
      (await fixtures.db.venue.findUniqueOrThrow({ where: { id: venueId } }))
        .status,
    ).toBe('PENDING');
    for (const body of [
      settingsBody(),
      {
        ...settingsBody(),
        weeklyHours: {
          monday: null,
          tuesday: null,
          wednesday: null,
          thursday: null,
          friday: null,
          saturday: null,
          sunday: null,
        },
      },
    ]) {
      const saved = await request(app.getHttpServer() as Server)
        .put(path())
        .set('Cookie', actors.owner.cookie)
        .send(body);
      expect(saved.status).toBe(200);
      expect(saved.body).toEqual({
        ...body,
        venueId,
        timezone: 'Asia/Manila',
        isDefault: false,
      });
      const read = await request(app.getHttpServer() as Server)
        .get(path())
        .set('Cookie', actors.customer.cookie);
      expect(read.body).toEqual(saved.body);
    }
    expect(
      await fixtures.db.venueOpeningHours.count({
        where: { settings: { venueId } },
      }),
    ).toBe(0);
    for (let i = 0; i < 2; i++)
      expect(
        (
          await request(app.getHttpServer() as Server)
            .delete(path())
            .set('Cookie', actors.owner.cookie)
        ).status,
      ).toBe(204);
    const reset = await request(app.getHttpServer() as Server)
      .get(path())
      .set('Cookie', actors.customer.cookie);
    expect((reset.body as VenueBookingSettingsResponse).isDefault).toBe(true);
  });
  it.each([
    { minDurationHours: 4, maxDurationHours: 3 },
    {
      weeklyHours: {
        ...settingsBody().weeklyHours,
        sunday: { opensAt: '02:00', closesAt: '12:00' },
      },
    },
    {
      weeklyHours: {
        ...settingsBody().weeklyHours,
        sunday: { opensAt: '22:00', closesAt: '07:00' },
      },
    },
    {
      minDurationHours: 2,
      weeklyHours: {
        ...settingsBody().weeklyHours,
        monday: { opensAt: '06:00', closesAt: '07:00' },
      },
    },
    {
      weeklyHours: {
        ...settingsBody().weeklyHours,
        monday: { opensAt: '6:00', closesAt: '00:00' },
      },
    },
    { weeklyHours: [] },
    { weeklyHours: [settingsBody().weeklyHours] },
    { weeklyHours: 'bad' },
    { weeklyHours: { ...settingsBody().weeklyHours, monday: [] } },
    {
      weeklyHours: {
        ...settingsBody().weeklyHours,
        monday: [{ opensAt: '06:00', closesAt: '00:00' }],
      },
    },
    { weeklyHours: { ...settingsBody().weeklyHours, monday: 'bad' } },
  ])('rejects invalid settings atomically %p', async (changes) => {
    await request(app.getHttpServer() as Server)
      .put(path())
      .set('Cookie', actors.owner.cookie)
      .send(settingsBody())
      .expect(200);
    const before = await fixtures.db.venueBookingSettings.findUnique({
      where: { venueId },
      include: { openingHours: { orderBy: { weekday: 'asc' } } },
    });
    await request(app.getHttpServer() as Server)
      .put(path())
      .set('Cookie', actors.owner.cookie)
      .send({ ...settingsBody(), ...changes })
      .expect(400);
    expect(
      await fixtures.db.venueBookingSettings.findUnique({
        where: { venueId },
        include: { openingHours: { orderBy: { weekday: 'asc' } } },
      }),
    ).toEqual(before);
  });
  it('cascades settings and hours when the owner deletes a venue', async () => {
    const target = await fixtures.createVenue(tenantId);
    await request(app.getHttpServer() as Server)
      .put(path(target.id))
      .set('Cookie', actors.owner.cookie)
      .send(settingsBody())
      .expect(200);
    const settings = await fixtures.db.venueBookingSettings.findUniqueOrThrow({
      where: { venueId: target.id },
    });
    await request(app.getHttpServer() as Server)
      .delete(`/venues/${target.id}`)
      .set('Cookie', actors.owner.cookie)
      .expect(204);
    expect(
      await fixtures.db.venueBookingSettings.count({
        where: { venueId: target.id },
      }),
    ).toBe(0);
    expect(
      await fixtures.db.venueOpeningHours.count({
        where: { settingsId: settings.id },
      }),
    ).toBe(0);
  });
});
