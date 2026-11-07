import { randomUUID } from 'node:crypto';
import { PrismaPg } from '@prisma/adapter-pg';
import { Prisma, PrismaClient } from '../generated/prisma/client';
import { getTestDatabaseUrl } from '../test-support/http-app';

const describeIfDb = process.env.TEST_DATABASE_URL ? describe : describe.skip;

const FOREIGN_KEY_VIOLATION = 'P2003';

describeIfDb(
  'court booking venue-scoped constraints (requires TEST_DATABASE_URL)',
  () => {
    let db: PrismaClient;
    const run = randomUUID().slice(0, 8);

    const createdUserIds: string[] = [];
    const createdTenantIds: string[] = [];
    const createdVenueIds: string[] = [];
    const createdCourtIds: string[] = [];
    const createdBookingIds: string[] = [];

    beforeAll(() => {
      db = new PrismaClient({
        adapter: new PrismaPg(getTestDatabaseUrl()),
      });
    });

    afterAll(async () => {
      if (!db) return;
      try {
        await db.courtBooking.deleteMany({
          where: { id: { in: createdBookingIds } },
        });
        await db.courtSchedule.deleteMany({
          where: { courtId: { in: createdCourtIds } },
        });
        await db.court.deleteMany({ where: { id: { in: createdCourtIds } } });
        await db.venue.deleteMany({ where: { id: { in: createdVenueIds } } });
        await db.tenant.deleteMany({ where: { id: { in: createdTenantIds } } });
        await db.user.deleteMany({ where: { id: { in: createdUserIds } } });
      } finally {
        await db.$disconnect();
      }
    });

    async function makeTenant(label: string): Promise<string> {
      const tenant = await db.tenant.create({
        data: { name: `Tenant ${label} ${run}` },
      });
      createdTenantIds.push(tenant.id);
      return tenant.id;
    }

    async function makeVenue(tenantId: string, label: string): Promise<string> {
      const venue = await db.venue.create({
        data: {
          tenantId,
          name: `Venue ${label}`,
          slug: `venue-${label}-${run}`,
        },
      });
      createdVenueIds.push(venue.id);
      return venue.id;
    }

    async function makeCourt(venueId: string): Promise<string> {
      const court = await db.court.create({
        data: { venueId, name: `Court ${run}` },
      });
      createdCourtIds.push(court.id);
      return court.id;
    }

    async function makeUser(
      label: string,
    ): Promise<{ id: string; email: string }> {
      const email = `${label}-${run}@example.com`;
      const user = await db.user.create({
        data: { name: `User ${label}`, email },
      });
      createdUserIds.push(user.id);
      return { id: user.id, email };
    }

    function bookingData(args: {
      venueId: string;
      courtId: string;
      userId: string | null;
      userEmail: string;
    }): Prisma.CourtBookingUncheckedCreateInput {
      return {
        bookDate: new Date('2026-06-01T10:00:00Z'),
        userEmail: args.userEmail,
        userId: args.userId,
        venueId: args.venueId,
        courtId: args.courtId,
        isActive: true,
        referenceId: `REF-${randomUUID()}`,
        isOpenPlay: false,
      };
    }

    it('rejects a booking whose venueId does not match its court venue', async () => {
      const tenantId = await makeTenant('mismatch');
      const venueA = await makeVenue(tenantId, 'a');
      const venueB = await makeVenue(tenantId, 'b');
      const courtInA = await makeCourt(venueA);
      const user = await makeUser('mismatch');

      const attempt = db.courtBooking.create({
        data: bookingData({
          venueId: venueB,
          courtId: courtInA,
          userId: user.id,
          userEmail: user.email,
        }),
      });

      await expect(attempt).rejects.toMatchObject({
        code: FOREIGN_KEY_VIOLATION,
      });
    });

    it('accepts a booking whose venueId matches its court venue', async () => {
      const tenantId = await makeTenant('match');
      const venueId = await makeVenue(tenantId, 'match');
      const courtId = await makeCourt(venueId);
      const user = await makeUser('match');

      const booking = await db.courtBooking.create({
        data: bookingData({
          venueId,
          courtId,
          userId: user.id,
          userEmail: user.email,
        }),
      });
      createdBookingIds.push(booking.id);

      expect(booking.venueId).toBe(venueId);
    });

    it('blocks deleting a venue that still has bookings', async () => {
      const tenantId = await makeTenant('venue-delete');
      const venueId = await makeVenue(tenantId, 'venue-delete');
      const courtId = await makeCourt(venueId);
      const user = await makeUser('venue-delete');
      const booking = await db.courtBooking.create({
        data: bookingData({
          venueId,
          courtId,
          userId: user.id,
          userEmail: user.email,
        }),
      });
      createdBookingIds.push(booking.id);

      await expect(
        db.venue.delete({ where: { id: venueId } }),
      ).rejects.toMatchObject({
        code: FOREIGN_KEY_VIOLATION,
      });
    });

    it('blocks deleting a tenant that still has bookings', async () => {
      const tenantId = await makeTenant('tenant-delete');
      const venueId = await makeVenue(tenantId, 'tenant-delete');
      const courtId = await makeCourt(venueId);
      const user = await makeUser('tenant-delete');
      const booking = await db.courtBooking.create({
        data: bookingData({
          venueId,
          courtId,
          userId: user.id,
          userEmail: user.email,
        }),
      });
      createdBookingIds.push(booking.id);

      await expect(
        db.tenant.delete({ where: { id: tenantId } }),
      ).rejects.toMatchObject({
        code: FOREIGN_KEY_VIOLATION,
      });
    });

    it('keeps a booking when its user is deleted, with userId cleared', async () => {
      const tenantId = await makeTenant('user-delete');
      const venueId = await makeVenue(tenantId, 'user-delete');
      const courtId = await makeCourt(venueId);
      const user = await makeUser('user-delete');
      const booking = await db.courtBooking.create({
        data: bookingData({
          venueId,
          courtId,
          userId: user.id,
          userEmail: user.email,
        }),
      });
      createdBookingIds.push(booking.id);

      await db.user.delete({ where: { id: user.id } });
      createdUserIds.splice(createdUserIds.indexOf(user.id), 1);

      const survivor = await db.courtBooking.findUnique({
        where: { id: booking.id },
      });
      expect(survivor).not.toBeNull();
      expect(survivor?.userId).toBeNull();
    });
  },
);
