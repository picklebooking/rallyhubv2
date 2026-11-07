import { randomUUID } from 'node:crypto';
import { jest } from '@jest/globals';
import { PrismaPg } from '@prisma/adapter-pg';
import { Prisma, PrismaClient } from '../generated/prisma/client';
import { CourtBookRepository } from '../court-book/court-book.repository';
import type { PrismaService } from '../prisma/prisma.service';
import { OpenPlayRepository } from './open-play.repository';

const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL;
const describeIfDb = TEST_DATABASE_URL ? describe : describe.skip;
const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
const FORBIDDEN = [
  'userEmail',
  'userId',
  'referenceId',
  'isPaid',
  'totalPrice',
  'openPlayJoinToken',
  'tenantId',
];

type VenueStatus = 'ACTIVE' | 'PENDING' | 'SUSPENDED';

describeIfDb('open play (requires TEST_DATABASE_URL)', () => {
  // Sequential fixture queries against a possibly-remote test DB can exceed
  // Jest's 5s default timeout, producing a false failure unrelated to the
  // code under test.
  jest.setTimeout(30_000);

  let db: PrismaClient;
  let repo: OpenPlayRepository;
  let courtBookRepo: CourtBookRepository;
  const run = randomUUID().slice(0, 8);
  const ids = {
    users: [] as string[],
    tenants: [] as string[],
    venues: [] as string[],
    courts: [] as string[],
    bookings: [] as string[],
  };

  beforeAll(() => {
    db = new PrismaClient({
      adapter: new PrismaPg(TEST_DATABASE_URL as string),
    });
    const prisma = { db } as unknown as PrismaService;
    repo = new OpenPlayRepository(prisma);
    courtBookRepo = new CourtBookRepository(prisma);
  });

  afterAll(async () => {
    await db.openPlaySeat.deleteMany({
      where: { bookingId: { in: ids.bookings } },
    });
    await db.courtBooking.deleteMany({ where: { id: { in: ids.bookings } } });
    await db.courtSchedule.deleteMany({
      where: { courtId: { in: ids.courts } },
    });
    await db.court.deleteMany({ where: { id: { in: ids.courts } } });
    await db.tenantMember.deleteMany({
      where: { tenantId: { in: ids.tenants } },
    });
    await db.venue.deleteMany({ where: { id: { in: ids.venues } } });
    await db.tenant.deleteMany({ where: { id: { in: ids.tenants } } });
    await db.user.deleteMany({ where: { id: { in: ids.users } } });
    await db.$disconnect();
  });

  async function user(label: string): Promise<string> {
    const u = await db.user.create({
      data: { name: `U ${label}`, email: `${label}-${run}@example.com` },
    });
    ids.users.push(u.id);
    return u.id;
  }

  async function tenant(): Promise<string> {
    const t = await db.tenant.create({ data: { name: `T ${run}` } });
    ids.tenants.push(t.id);
    return t.id;
  }

  async function venue(
    tenantId: string,
    status: VenueStatus = 'ACTIVE',
  ): Promise<string> {
    const v = await db.venue.create({
      data: {
        tenantId,
        name: 'V',
        slug: `op-${randomUUID().slice(0, 8)}`,
        status,
      },
    });
    ids.venues.push(v.id);
    return v.id;
  }

  async function court(
    status: VenueStatus = 'ACTIVE',
  ): Promise<{ tenantId: string; venueId: string; courtId: string }> {
    const tenantId = await tenant();
    const venueId = await venue(tenantId, status);
    const c = await db.court.create({ data: { venueId, name: 'C' } });
    ids.courts.push(c.id);
    return { tenantId, venueId, courtId: c.id };
  }

  async function openPlay(args: {
    bookerId: string;
    capacity: number;
    isPublic?: boolean;
    startsInMs?: number;
    isActive?: boolean;
    status?: VenueStatus;
  }): Promise<{
    id: string;
    courtId: string;
    venueId: string;
    referenceId: string;
    bookDate: Date;
    joinToken: string;
  }> {
    const { venueId, courtId } = await court(args.status);
    const bookDate = new Date(Date.now() + (args.startsInMs ?? 7 * DAY));
    const referenceId = `RH-${randomUUID().slice(0, 8)}`;
    const joinToken = randomUUID();
    const b = await db.courtBooking.create({
      data: {
        venueId,
        courtId,
        userEmail: 'b@example.com',
        userId: args.bookerId,
        bookDate,
        isActive: args.isActive ?? true,
        referenceId,
        isOpenPlay: true,
        openPlayCapacity: args.capacity,
        isOpenPlayPublic: args.isPublic ?? true,
        openPlayJoinToken: joinToken,
        openPlaySeats: { create: { userId: args.bookerId, isBooker: true } },
      },
    });
    ids.bookings.push(b.id);
    await db.courtSchedule.create({
      data: {
        courtId,
        venueId,
        userEmail: 'b@example.com',
        userId: args.bookerId,
        bookedDate: bookDate,
        isVacant: false,
        isActive: true,
        hoursBooked: 2,
        dateTimeVacant: new Date(bookDate.getTime() + 2 * HOUR),
        referenceId,
      },
    });
    return { id: b.id, courtId, venueId, referenceId, bookDate, joinToken };
  }

  it('lets exactly one of eight concurrent joins take the last seat', async () => {
    const booker = await user('booker1');
    // 8 racers: enough to interleave inside the lock window, and under the
    // pg pool default of 10 so no racer is serialized by connection checkout.
    const racers = await Promise.all(
      Array.from({ length: 8 }, (_, i) => user(`racer1-${i}`)),
    );
    const booking = await openPlay({ bookerId: booker, capacity: 2 });
    const now = new Date();

    const outcomes = await Promise.all(
      racers.map((userId) =>
        repo.joinSeat({
          bookingId: booking.id,
          userId,
          now,
          requirePublic: false,
        }),
      ),
    );

    const kinds = outcomes.map((o) => o.kind);
    expect(kinds.filter((k) => k === 'JOINED')).toHaveLength(1);
    expect(kinds.filter((k) => k === 'FULL')).toHaveLength(7);
    expect(
      await db.openPlaySeat.count({ where: { bookingId: booking.id } }),
    ).toBe(2);
  });

  it('lets one of two concurrent joins by the same user win, and the unique constraint backs it', async () => {
    const booker = await user('booker2');
    const a = await user('a2');
    const booking = await openPlay({ bookerId: booker, capacity: 4 });
    const now = new Date();

    const outcomes = await Promise.all([
      repo.joinSeat({
        bookingId: booking.id,
        userId: a,
        now,
        requirePublic: false,
      }),
      repo.joinSeat({
        bookingId: booking.id,
        userId: a,
        now,
        requirePublic: false,
      }),
    ]);
    expect(outcomes.map((o) => o.kind).sort()).toEqual([
      'ALREADY_SEATED',
      'JOINED',
    ]);

    await expect(
      db.openPlaySeat.create({ data: { bookingId: booking.id, userId: a } }),
    ).rejects.toMatchObject({
      code: 'P2002',
    } satisfies Partial<Prisma.PrismaClientKnownRequestError>);
  });

  it('never leaves a cancelled booking holding a non-booker seat when join races cancel inside 24h', async () => {
    for (let round = 0; round < 5; round++) {
      const booker = await user(`booker-jc-${round}`);
      const joiner = await user(`joiner-jc-${round}`);
      const booking = await openPlay({
        bookerId: booker,
        capacity: 4,
        startsInMs: 12 * HOUR,
      });
      const now = new Date();

      const [join, cancel] = await Promise.all([
        repo.joinSeat({
          bookingId: booking.id,
          userId: joiner,
          now,
          requirePublic: false,
        }),
        repo.cancelBooking({ bookingId: booking.id, bookerId: booker, now }),
      ]);

      const { isActive } = await db.courtBooking.findUniqueOrThrow({
        where: { id: booking.id },
        select: { isActive: true },
      });
      const others = await db.openPlaySeat.count({
        where: { bookingId: booking.id, isBooker: false },
      });
      const order = `${join.kind}/${cancel.kind}`;

      // Exactly one of the two serial orders, never a mix.
      expect(['JOINED/OTHER_PLAYERS', 'NOT_JOINABLE/CANCELLED']).toContain(
        order,
      );
      expect({ isActive, others }).toEqual(
        order === 'JOINED/OTHER_PLAYERS'
          ? { isActive: true, others: 1 }
          : { isActive: false, others: 0 },
      );
    }
  });

  it('rejects a join on an already-cancelled booking', async () => {
    const booker = await user('booker-cx');
    const a = await user('a-cx');
    const booking = await openPlay({
      bookerId: booker,
      capacity: 4,
      isActive: false,
    });

    expect(
      (
        await repo.joinSeat({
          bookingId: booking.id,
          userId: a,
          now: new Date(),
          requirePublic: false,
        })
      ).kind,
    ).toBe('NOT_JOINABLE');
    expect(await repo.findViewableByToken(booking.joinToken)).toBeNull();
    expect(
      await db.openPlaySeat.count({ where: { bookingId: booking.id } }),
    ).toBe(1);
  });

  it('reopens a full booking when a player leaves', async () => {
    const booker = await user('booker3');
    const a = await user('a3');
    const c = await user('c3');
    const booking = await openPlay({ bookerId: booker, capacity: 2 });
    const now = new Date();

    expect(
      (
        await repo.joinSeat({
          bookingId: booking.id,
          userId: a,
          now,
          requirePublic: false,
        })
      ).kind,
    ).toBe('JOINED');
    expect(
      (
        await repo.joinSeat({
          bookingId: booking.id,
          userId: c,
          now,
          requirePublic: false,
        })
      ).kind,
    ).toBe('FULL');
    expect(
      (await repo.leaveSeat({ bookingId: booking.id, userId: a, now })).kind,
    ).toBe('LEFT');
    expect(
      (
        await repo.joinSeat({
          bookingId: booking.id,
          userId: c,
          now,
          requirePublic: false,
        })
      ).kind,
    ).toBe('JOINED');
  });

  it('discovery keeps full games, excludes private/cancelled/past/non-ACTIVE-venue/booker-deleted ones, and leaks no forbidden fields', async () => {
    const booker = await user('booker4');
    const full = await openPlay({ bookerId: booker, capacity: 1 });
    const hidden = await openPlay({
      bookerId: booker,
      capacity: 4,
      isPublic: false,
    });
    const cancelled = await openPlay({
      bookerId: booker,
      capacity: 4,
      isActive: false,
    });
    const past = await openPlay({
      bookerId: booker,
      capacity: 4,
      startsInMs: -DAY,
    });
    const pendingVenue = await openPlay({
      bookerId: booker,
      capacity: 4,
      status: 'PENDING',
    });
    const suspendedVenue = await openPlay({
      bookerId: booker,
      capacity: 4,
      status: 'SUSPENDED',
    });
    const ghost = await user('ghost4');
    const orphaned = await openPlay({ bookerId: ghost, capacity: 4 });
    await db.user.delete({ where: { id: ghost } }); // booking.userId -> NULL, booker seat cascades away

    // Each fixture booking has its own venue, so query per venue: other rows
    // in a shared test DB can never push ours off the page.
    const listFor = async (b: { venueId: string }) =>
      (
        await repo.listPublic({
          now: new Date(),
          venueId: b.venueId,
          skip: 0,
          take: 50,
        })
      ).records;
    const records = (
      await Promise.all(
        [
          full,
          hidden,
          cancelled,
          past,
          pendingVenue,
          suspendedVenue,
          orphaned,
        ].map(listFor),
      )
    ).flat();
    const listed = records.map((r) => r.id);

    expect(listed).toContain(full.id);
    expect(records.find((r) => r.id === full.id)?.confirmedSeats).toBe(1);
    for (const excluded of [
      hidden,
      cancelled,
      past,
      pendingVenue,
      suspendedVenue,
      orphaned,
    ]) {
      expect(listed).not.toContain(excluded.id);
    }
    const keys = JSON.stringify(records);
    for (const forbidden of FORBIDDEN)
      expect(keys).not.toContain(`"${forbidden}"`);
  });

  it('hides SUSPENDED-venue and booker-deleted games from the token/id reads and refuses joins under the lock', async () => {
    const booker = await user('booker6');
    const joiner = await user('joiner6');
    const suspended = await openPlay({
      bookerId: booker,
      capacity: 4,
      status: 'SUSPENDED',
    });
    const ghost = await user('ghost6');
    const orphaned = await openPlay({ bookerId: ghost, capacity: 4 });
    await db.user.delete({ where: { id: ghost } });

    for (const b of [suspended, orphaned]) {
      expect(await repo.findViewableByToken(b.joinToken)).toBeNull();
      expect(await repo.findViewableById(b.id)).toBeNull();
      expect(
        (
          await repo.joinSeat({
            bookingId: b.id,
            userId: joiner,
            now: new Date(),
            requirePublic: false,
          })
        ).kind,
      ).toBe('NOT_JOINABLE');
    }
    // The management read still sees the suspended-venue booking.
    expect(await repo.findById(suspended.id)).not.toBeNull();
  });

  it('cancel deactivates the booking, frees its schedule rows, and frees the court slot', async () => {
    const booker = await user('booker5');
    const booking = await openPlay({ bookerId: booker, capacity: 4 });
    const start = booking.bookDate.toISOString();
    const end = new Date(booking.bookDate.getTime() + HOUR);

    expect(
      await courtBookRepo.hasConflictBooking(booking.courtId, end, start),
    ).toBe(true);
    expect(
      (
        await repo.cancelBooking({
          bookingId: booking.id,
          bookerId: booker,
          now: new Date(),
        })
      ).kind,
    ).toBe('CANCELLED');

    const row = await db.courtBooking.findUniqueOrThrow({
      where: { id: booking.id },
      select: { isActive: true },
    });
    expect(row.isActive).toBe(false);
    const schedules = await db.courtSchedule.findMany({
      where: { referenceId: booking.referenceId, courtId: booking.courtId },
      select: { isActive: true, isVacant: true },
    });
    expect(schedules).toEqual([{ isActive: false, isVacant: true }]);
    expect(
      await courtBookRepo.hasConflictBooking(booking.courtId, end, start),
    ).toBe(false);
  });

  it('a schedule row with a NULL isActive still blocks its slot', async () => {
    const booker = await user('booker7');
    const { venueId, courtId } = await court();
    const bookedDate = new Date(Date.now() + 7 * DAY);
    await db.courtSchedule.create({
      data: {
        courtId,
        venueId,
        userEmail: 'b@example.com',
        userId: booker,
        bookedDate,
        isVacant: false,
        isActive: null,
        hoursBooked: 2,
        dateTimeVacant: new Date(bookedDate.getTime() + 2 * HOUR),
        referenceId: `RH-${randomUUID().slice(0, 8)}`,
      },
    });

    expect(
      await courtBookRepo.hasConflictBooking(
        courtId,
        new Date(bookedDate.getTime() + HOUR),
        bookedDate.toISOString(),
      ),
    ).toBe(true);
  });

  it('resolves staff membership against real TenantMember rows (AC-08)', async () => {
    const t1 = await tenant();
    const t2 = await tenant();
    const v1 = await venue(t1);
    const v2 = await venue(t1);

    const owner = await user('owner8');
    const staffSameVenue = await user('staff-same8');
    const staffOtherVenue = await user('staff-other-venue8');
    const staffOtherTenant = await user('staff-other-tenant8');
    const nonMember = await user('non-member8');
    const inactiveStaff = await user('inactive-staff8');

    await db.tenantMember.createMany({
      data: [
        { userId: owner, tenantId: t1, venueId: null, role: 'OWNER' },
        { userId: staffSameVenue, tenantId: t1, venueId: v1, role: 'STAFF' },
        { userId: staffOtherVenue, tenantId: t1, venueId: v2, role: 'STAFF' },
        // Tenant-wide OWNER of another tenant: venueId null passes the
        // venue-scope clause, so only the tenantId condition excludes it.
        {
          userId: staffOtherTenant,
          tenantId: t2,
          venueId: null,
          role: 'OWNER',
        },
        // Tenant-wide STAFF of the right tenant: inactive membership excludes it.
        {
          userId: inactiveStaff,
          tenantId: t1,
          venueId: null,
          role: 'STAFF',
          isActive: false,
        },
      ],
    });

    const results = await Promise.all(
      [
        owner,
        staffSameVenue,
        staffOtherVenue,
        staffOtherTenant,
        nonMember,
        inactiveStaff,
      ].map((u) => repo.hasVenueStaffMembership(u, t1, v1)),
    );
    expect(results).toEqual([true, true, false, false, false, false]);
  });
});
