import { jest } from '@jest/globals';
import { Prisma } from '../generated/prisma/client';
import type { PrismaClient as PrismaClientType } from '../generated/prisma/client';
import type { PrismaService } from '../prisma/prisma.service';
import {
  OPEN_PLAY_TX_OPTIONS,
  OpenPlayRepository,
  openPlayJoinableWhere,
  openPlayLiveScalars,
  openPlayViewableWhere,
} from './open-play.repository';

type MockFn = ReturnType<typeof jest.fn>;

const FORBIDDEN = [
  'userEmail',
  'userId',
  'referenceId',
  'isPaid',
  'totalPrice',
  'openPlayJoinToken',
  'tenantId',
];

function collectKeys(value: unknown, keys: string[] = []): string[] {
  if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) {
      keys.push(k);
      collectKeys(v, keys);
    }
  }
  return keys;
}

function knownError(code: string): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError(`mock ${code}`, {
    code,
    clientVersion: 'test',
  });
}

/** Typed so `mockResolvedValue` accepts fixtures (an untyped `jest.fn()` takes `never`). */
function asyncMock() {
  return jest.fn<(...args: unknown[]) => Promise<unknown>>();
}

function createTx() {
  return {
    courtBooking: {
      updateMany: asyncMock(),
      update: asyncMock(),
      findFirst: asyncMock(),
      findUniqueOrThrow: asyncMock(),
    },
    openPlaySeat: {
      findUnique: asyncMock(),
      create: asyncMock(),
      deleteMany: asyncMock(),
      count: asyncMock(),
    },
    courtSchedule: { updateMany: asyncMock() },
  };
}

describe('OpenPlayRepository', () => {
  let tx: ReturnType<typeof createTx>;
  let prismaService: PrismaService;
  let repository: OpenPlayRepository;
  const now = new Date('2026-10-07T00:00:00.000Z');

  beforeEach(() => {
    tx = createTx();
    prismaService = {
      db: {
        courtBooking: {
          findMany: jest.fn(),
          count: jest.fn(),
          findUnique: jest.fn(),
          findFirst: jest.fn(),
          updateMany: jest.fn(),
        },
        openPlaySeat: {
          findUnique: jest.fn(),
          findMany: jest.fn(),
          count: jest.fn(),
          groupBy: jest.fn(),
        },
        tenantMember: { findFirst: jest.fn() },
        $transaction: jest.fn(async (fn: unknown) =>
          (fn as (t: unknown) => Promise<unknown>)(tx),
        ),
      } as unknown as PrismaClientType,
    } as PrismaService;
    repository = new OpenPlayRepository(prismaService);
  });

  describe('shared where builders', () => {
    it('keeps the lock-safe half scalar-only', () => {
      expect(openPlayLiveScalars()).toEqual({
        isOpenPlay: true,
        isActive: true,
        openPlayCapacity: { not: null },
        openPlayJoinToken: { not: null },
        userId: { not: null },
      });
    });

    it('adds the ACTIVE-venue check for viewable, and bookDate > now for joinable', () => {
      expect(openPlayViewableWhere()).toEqual({
        ...openPlayLiveScalars(),
        court: { venue: { status: 'ACTIVE' } },
      });
      expect(openPlayJoinableWhere(now)).toEqual({
        ...openPlayViewableWhere(),
        bookDate: { gt: now },
      });
    });
  });

  describe('listPublic', () => {
    it('filters with the joinable builder plus public, venue, and range, and paginates', async () => {
      (prismaService.db.courtBooking.findMany as MockFn).mockResolvedValue([]);
      (prismaService.db.courtBooking.count as MockFn).mockResolvedValue(0);
      const from = new Date('2026-10-10T00:00:00.000Z');
      const to = new Date('2026-10-11T00:00:00.000Z');

      await repository.listPublic({
        now,
        venueId: 'venue-1',
        from,
        to,
        skip: 20,
        take: 20,
      });

      const args = (prismaService.db.courtBooking.findMany as MockFn).mock
        .calls[0][0] as {
        where: unknown;
        select: unknown;
        orderBy: unknown;
        skip: number;
        take: number;
      };
      expect(args.where).toEqual({
        ...openPlayJoinableWhere(now),
        bookDate: { gt: now, gte: from, lt: to },
        isOpenPlayPublic: true,
        venueId: 'venue-1',
      });
      expect(args.orderBy).toEqual([{ bookDate: 'asc' }, { id: 'asc' }]);
      expect(args.skip).toBe(20);
      expect(args.take).toBe(20);
      expect(prismaService.db.courtBooking.count).toHaveBeenCalledWith({
        where: args.where,
      });
      // Plain Promise.all, not an array $transaction (no consistency gain under READ COMMITTED).
      expect(prismaService.db.$transaction).not.toHaveBeenCalled();
    });

    it('counts seats with one groupBy scoped to the page ids', async () => {
      (prismaService.db.courtBooking.findMany as MockFn).mockResolvedValue([
        { id: 'b-1' },
        { id: 'b-2' },
      ]);
      (prismaService.db.courtBooking.count as MockFn).mockResolvedValue(2);
      (prismaService.db.openPlaySeat.groupBy as MockFn).mockResolvedValue([
        { bookingId: 'b-1', _count: { _all: 3 } },
      ]);

      const { records, total } = await repository.listPublic({
        now,
        skip: 0,
        take: 20,
      });

      expect(prismaService.db.openPlaySeat.groupBy).toHaveBeenCalledWith({
        by: ['bookingId'],
        where: { bookingId: { in: ['b-1', 'b-2'] } },
        _count: { _all: true },
      });
      expect(records.map((r) => r.confirmedSeats)).toEqual([3, 0]);
      expect(total).toBe(2);
    });

    it('skips the seat query for an empty page', async () => {
      (prismaService.db.courtBooking.findMany as MockFn).mockResolvedValue([]);
      (prismaService.db.courtBooking.count as MockFn).mockResolvedValue(0);
      await repository.listPublic({ now, skip: 0, take: 20 });
      expect(prismaService.db.openPlaySeat.groupBy).not.toHaveBeenCalled();
    });

    it('never selects forbidden columns or a relation _count', async () => {
      (prismaService.db.courtBooking.findMany as MockFn).mockResolvedValue([]);
      (prismaService.db.courtBooking.count as MockFn).mockResolvedValue(0);

      await repository.listPublic({ now, skip: 0, take: 20 });

      const { select } = (prismaService.db.courtBooking.findMany as MockFn).mock
        .calls[0][0] as { select: unknown };
      const keys = collectKeys(select);
      for (const forbidden of [...FORBIDDEN, '_count']) {
        expect(keys).not.toContain(forbidden);
      }
      expect(keys).toContain('timezone');
    });
  });

  describe('findViewableByToken / findViewableById', () => {
    it('reads through the viewable builder and attaches a scoped seat count', async () => {
      (prismaService.db.courtBooking.findFirst as MockFn).mockResolvedValue({
        id: 'b-1',
      });
      (prismaService.db.openPlaySeat.count as MockFn).mockResolvedValue(2);

      const record = await repository.findViewableByToken('tok');

      expect(prismaService.db.courtBooking.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { openPlayJoinToken: 'tok', ...openPlayViewableWhere() },
        }),
      );
      expect(prismaService.db.openPlaySeat.count).toHaveBeenCalledWith({
        where: { bookingId: 'b-1' },
      });
      expect(record?.confirmedSeats).toBe(2);
    });

    it('returns null (cancelled, venue not ACTIVE, booker deleted) without counting', async () => {
      (prismaService.db.courtBooking.findFirst as MockFn).mockResolvedValue(
        null,
      );
      expect(await repository.findViewableById('b-1')).toBeNull();
      expect(prismaService.db.courtBooking.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'b-1', ...openPlayViewableWhere() },
        }),
      );
      expect(prismaService.db.openPlaySeat.count).not.toHaveBeenCalled();
    });
  });

  describe('joinSeat', () => {
    const args = { bookingId: 'b-1', userId: 'u-2', now, requirePublic: false };

    function lockAndRecheckPass(capacity = 4): void {
      tx.courtBooking.updateMany.mockResolvedValue({ count: 1 });
      tx.courtBooking.findFirst.mockResolvedValue({
        openPlayCapacity: capacity,
      });
      tx.openPlaySeat.findUnique.mockResolvedValue(null);
    }

    it('runs with explicit transaction bounds', async () => {
      tx.courtBooking.updateMany.mockResolvedValue({ count: 0 });
      await repository.joinSeat(args);
      expect(prismaService.db.$transaction).toHaveBeenCalledWith(
        expect.any(Function),
        OPEN_PLAY_TX_OPTIONS,
      );
      expect(OPEN_PLAY_TX_OPTIONS).toEqual({ maxWait: 5_000, timeout: 10_000 });
    });

    it('returns NOT_JOINABLE when the lock update matches nothing', async () => {
      tx.courtBooking.updateMany.mockResolvedValue({ count: 0 });
      expect(await repository.joinSeat(args)).toEqual({ kind: 'NOT_JOINABLE' });
      expect(tx.courtBooking.findFirst).not.toHaveBeenCalled();
      expect(tx.openPlaySeat.findUnique).not.toHaveBeenCalled();
      expect(tx.openPlaySeat.count).not.toHaveBeenCalled();
      expect(tx.openPlaySeat.create).not.toHaveBeenCalled();
    });

    it('locks with the scalar preconditions only, adding isOpenPlayPublic when required', async () => {
      tx.courtBooking.updateMany.mockResolvedValue({ count: 0 });
      await repository.joinSeat({ ...args, requirePublic: true });
      expect(tx.courtBooking.updateMany).toHaveBeenCalledWith({
        where: {
          id: 'b-1',
          ...openPlayLiveScalars(),
          bookDate: { gt: now },
          isOpenPlayPublic: true,
        },
        data: { updatedAt: now },
      });
    });

    it('re-checks the full joinable builder (venue status) under the lock', async () => {
      tx.courtBooking.updateMany.mockResolvedValue({ count: 1 });
      tx.courtBooking.findFirst.mockResolvedValue(null); // e.g. venue SUSPENDED
      expect(
        await repository.joinSeat({ ...args, requirePublic: true }),
      ).toEqual({ kind: 'NOT_JOINABLE' });
      expect(tx.courtBooking.findFirst).toHaveBeenCalledWith({
        where: {
          id: 'b-1',
          ...openPlayJoinableWhere(now),
          isOpenPlayPublic: true,
        },
        select: { openPlayCapacity: true },
      });
      expect(tx.openPlaySeat.create).not.toHaveBeenCalled();
    });

    it('returns ALREADY_SEATED when the user holds a seat', async () => {
      lockAndRecheckPass();
      tx.openPlaySeat.findUnique.mockResolvedValue({ id: 's-1' });
      expect(await repository.joinSeat(args)).toEqual({
        kind: 'ALREADY_SEATED',
      });
    });

    it('returns FULL at capacity, counting seats with a scoped count', async () => {
      lockAndRecheckPass(4);
      tx.openPlaySeat.count.mockResolvedValue(4);
      expect(await repository.joinSeat(args)).toEqual({ kind: 'FULL' });
      expect(tx.openPlaySeat.count).toHaveBeenCalledWith({
        where: { bookingId: 'b-1' },
      });
      expect(tx.openPlaySeat.create).not.toHaveBeenCalled();
    });

    it('creates a non-booker seat and returns the new count', async () => {
      lockAndRecheckPass(4);
      tx.openPlaySeat.count.mockResolvedValue(2);
      expect(await repository.joinSeat(args)).toEqual({
        kind: 'JOINED',
        confirmedSeats: 3,
        capacity: 4,
      });
      expect(tx.openPlaySeat.create).toHaveBeenCalledWith({
        data: { bookingId: 'b-1', userId: 'u-2', isBooker: false },
      });
      // The lock must be taken before any read it guards (else overbooking).
      const order = [
        tx.courtBooking.updateMany,
        tx.courtBooking.findFirst,
        tx.openPlaySeat.findUnique,
        tx.openPlaySeat.count,
        tx.openPlaySeat.create,
      ].map((mock) => mock.mock.invocationCallOrder[0]);
      expect(order.every((n) => typeof n === 'number')).toBe(true);
      expect([...order].sort((a, b) => a - b)).toEqual(order);
    });

    it.each([
      [
        'P2002 (duplicate seat)',
        knownError('P2002'),
        { kind: 'ALREADY_SEATED' },
      ],
      [
        'P2003 (booking or user vanished)',
        knownError('P2003'),
        { kind: 'NOT_JOINABLE' },
      ],
      ['P2028 (transaction timeout)', knownError('P2028'), { kind: 'BUSY' }],
      ['P2034 (write conflict)', knownError('P2034'), { kind: 'BUSY' }],
      [
        'a Postgres deadlock',
        new Error('ERROR: deadlock detected (SQLSTATE 40P01)'),
        { kind: 'BUSY' },
      ],
    ])(
      'maps %s to an outcome instead of a 500',
      async (_label, error, expected) => {
        (prismaService.db.$transaction as MockFn).mockRejectedValueOnce(error);
        expect(await repository.joinSeat(args)).toEqual(expected);
      },
    );

    it('rethrows errors it does not recognize', async () => {
      (prismaService.db.$transaction as MockFn).mockRejectedValueOnce(
        new Error('boom'),
      );
      await expect(repository.joinSeat(args)).rejects.toThrow('boom');
    });
  });

  describe('leaveSeat', () => {
    it('locks only bookings starting at or after now + 24h', async () => {
      tx.courtBooking.updateMany.mockResolvedValue({ count: 0 });
      expect(
        await repository.leaveSeat({ bookingId: 'b-1', userId: 'u-2', now }),
      ).toEqual({ kind: 'NOT_LEAVABLE' });
      expect(tx.courtBooking.updateMany).toHaveBeenCalledWith({
        where: {
          id: 'b-1',
          isOpenPlay: true,
          isActive: true,
          bookDate: { gte: new Date('2026-10-08T00:00:00.000Z') },
        },
        data: { updatedAt: now },
      });
    });

    it('deletes only a non-booker seat', async () => {
      tx.courtBooking.updateMany.mockResolvedValue({ count: 1 });
      tx.openPlaySeat.deleteMany.mockResolvedValue({ count: 1 });
      expect(
        await repository.leaveSeat({ bookingId: 'b-1', userId: 'u-2', now }),
      ).toEqual({ kind: 'LEFT' });
      expect(tx.openPlaySeat.deleteMany).toHaveBeenCalledWith({
        where: { bookingId: 'b-1', userId: 'u-2', isBooker: false },
      });
    });

    it('returns NO_SEAT when nothing was deleted', async () => {
      tx.courtBooking.updateMany.mockResolvedValue({ count: 1 });
      tx.openPlaySeat.deleteMany.mockResolvedValue({ count: 0 });
      expect(
        await repository.leaveSeat({ bookingId: 'b-1', userId: 'u-2', now }),
      ).toEqual({ kind: 'NO_SEAT' });
    });

    it('returns BUSY on a transaction timeout', async () => {
      (prismaService.db.$transaction as MockFn).mockRejectedValueOnce(
        knownError('P2028'),
      );
      expect(
        await repository.leaveSeat({ bookingId: 'b-1', userId: 'u-2', now }),
      ).toEqual({ kind: 'BUSY' });
    });
  });

  describe('cancelBooking', () => {
    const args = { bookingId: 'b-1', bookerId: 'u-1', now };

    it('locks only the booker’s own active, not-yet-started Open Play booking', async () => {
      tx.courtBooking.updateMany.mockResolvedValue({ count: 0 });
      expect(await repository.cancelBooking(args)).toEqual({
        kind: 'NOT_CANCELLABLE',
      });
      expect(tx.courtBooking.updateMany).toHaveBeenCalledWith({
        where: {
          id: 'b-1',
          isOpenPlay: true,
          isActive: true,
          userId: 'u-1',
          bookDate: { gt: now },
        },
        data: { updatedAt: now },
      });
      expect(tx.courtBooking.findUniqueOrThrow).not.toHaveBeenCalled();
      expect(tx.openPlaySeat.count).not.toHaveBeenCalled();
      expect(tx.courtBooking.update).not.toHaveBeenCalled();
      expect(tx.courtSchedule.updateMany).not.toHaveBeenCalled();
    });

    it('rejects inside the cutoff when other players hold seats', async () => {
      tx.courtBooking.updateMany.mockResolvedValue({ count: 1 });
      tx.courtBooking.findUniqueOrThrow.mockResolvedValue({
        bookDate: new Date('2026-10-07T12:00:00.000Z'),
        courtId: 'c-1',
        referenceId: 'RH-1',
      });
      tx.openPlaySeat.count.mockResolvedValue(1);
      expect(await repository.cancelBooking(args)).toEqual({
        kind: 'OTHER_PLAYERS',
      });
      expect(tx.courtBooking.update).not.toHaveBeenCalled();
    });

    it('cancels inside the cutoff when the booker is alone, freeing the schedule', async () => {
      tx.courtBooking.updateMany.mockResolvedValue({ count: 1 });
      tx.courtBooking.findUniqueOrThrow.mockResolvedValue({
        bookDate: new Date('2026-10-07T12:00:00.000Z'),
        courtId: 'c-1',
        referenceId: 'RH-1',
      });
      tx.openPlaySeat.count.mockResolvedValue(0);
      expect(await repository.cancelBooking(args)).toEqual({
        kind: 'CANCELLED',
      });
      expect(tx.courtBooking.update).toHaveBeenCalledWith({
        where: { id: 'b-1' },
        data: { isActive: false },
      });
      expect(tx.courtSchedule.updateMany).toHaveBeenCalledWith({
        where: { referenceId: 'RH-1', courtId: 'c-1' },
        data: { isActive: false, isVacant: true },
      });
    });

    it('cancels outside the cutoff without counting seats', async () => {
      tx.courtBooking.updateMany.mockResolvedValue({ count: 1 });
      tx.courtBooking.findUniqueOrThrow.mockResolvedValue({
        bookDate: new Date('2026-10-20T12:00:00.000Z'),
        courtId: 'c-1',
        referenceId: 'RH-1',
      });
      expect(await repository.cancelBooking(args)).toEqual({
        kind: 'CANCELLED',
      });
      expect(tx.openPlaySeat.count).not.toHaveBeenCalled();
    });
  });

  describe('enableOpenPlay', () => {
    const args = {
      bookingId: 'b-1',
      now,
      capacity: 4,
      isPublic: false,
      token: 'tok',
    };

    it('locks only an active, not-yet-started, non-Open-Play booking with a booker', async () => {
      tx.courtBooking.updateMany.mockResolvedValue({ count: 0 });
      expect(await repository.enableOpenPlay(args)).toEqual({
        kind: 'NOT_ENABLEABLE',
      });
      expect(tx.courtBooking.updateMany).toHaveBeenCalledWith({
        where: {
          id: 'b-1',
          isOpenPlay: false,
          isActive: true,
          userId: { not: null },
          bookDate: { gt: now },
        },
        data: { updatedAt: now },
      });
      expect(tx.courtBooking.findUniqueOrThrow).not.toHaveBeenCalled();
      expect(tx.courtBooking.update).not.toHaveBeenCalled();
      expect(tx.openPlaySeat.create).not.toHaveBeenCalled();
    });

    it('sets fields and creates the booker seat', async () => {
      tx.courtBooking.updateMany.mockResolvedValue({ count: 1 });
      tx.courtBooking.findUniqueOrThrow.mockResolvedValue({ userId: 'u-1' });
      expect(await repository.enableOpenPlay(args)).toEqual({
        kind: 'ENABLED',
      });
      expect(tx.courtBooking.update).toHaveBeenCalledWith({
        where: { id: 'b-1' },
        data: {
          isOpenPlay: true,
          openPlayCapacity: 4,
          isOpenPlayPublic: false,
          openPlayJoinToken: 'tok',
        },
      });
      expect(tx.openPlaySeat.create).toHaveBeenCalledWith({
        data: { bookingId: 'b-1', userId: 'u-1', isBooker: true },
      });
    });

    it('maps a unique violation (token or seat) to NOT_ENABLEABLE', async () => {
      (prismaService.db.$transaction as MockFn).mockRejectedValueOnce(
        knownError('P2002'),
      );
      expect(await repository.enableOpenPlay(args)).toEqual({
        kind: 'NOT_ENABLEABLE',
      });
    });
  });

  describe('hasVenueStaffMembership', () => {
    it('matches OWNER/STAFF that are tenant-wide or scoped to this venue', async () => {
      (prismaService.db.tenantMember.findFirst as MockFn).mockResolvedValue({
        id: 'm-1',
      });
      expect(
        await repository.hasVenueStaffMembership('u-1', 't-1', 'v-1'),
      ).toBe(true);
      expect(prismaService.db.tenantMember.findFirst).toHaveBeenCalledWith({
        where: {
          userId: 'u-1',
          tenantId: 't-1',
          isActive: true,
          role: { in: ['OWNER', 'STAFF'] },
          OR: [{ venueId: null }, { venueId: 'v-1' }],
        },
        select: { id: true },
      });
    });
  });
});
