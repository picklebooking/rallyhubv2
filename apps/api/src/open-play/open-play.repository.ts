import {
  INTERACTIVE_TX_OPTIONS,
  isRetryableTransactionError,
} from '../prisma/interactive-transaction';
import { Injectable } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { bookableCourtWhere } from '../courts/court-bookability';
import {
  isFull,
  isInsideCutoff,
  latestLeaveableStart,
} from './open-play.rules';

/**
 * The scalar half of "this Open Play game is live": flag, active, invariant
 * columns set, and a booker who still exists. Scalar-only on purpose: this
 * is what goes into the lock's `updateMany` `where`, which must stay a
 * single conditional `UPDATE` on `CourtBooking`.
 *
 * @returns {Prisma.CourtBookingWhereInput}
 */
export function openPlayLiveScalars(): Prisma.CourtBookingWhereInput {
  return {
    isOpenPlay: true,
    isActive: true,
    openPlayCapacity: { not: null },
    openPlayJoinToken: { not: null },
    userId: { not: null },
  };
}

/**
 * The single definition of "viewable": live, on a bookable court. Used by
 * the token view, both join paths, and (via `openPlayJoinableWhere`)
 * discovery. Don't re-spell these conditions anywhere else.
 *
 * @returns {Prisma.CourtBookingWhereInput}
 */
export function openPlayViewableWhere(): Prisma.CourtBookingWhereInput {
  return {
    ...openPlayLiveScalars(),
    court: bookableCourtWhere(),
  };
}

/**
 * "Joinable" = viewable and not yet started.
 *
 * @param   {Date} now The current time.
 * @returns {Prisma.CourtBookingWhereInput}
 */
export function openPlayJoinableWhere(
  now: Date,
): Prisma.CourtBookingWhereInput {
  return { ...openPlayViewableWhere(), bookDate: { gt: now } };
}

/** Safe-to-publish columns only. Never add forbidden fields or `_count` here (AC-08, perf). */
const LISTING_SELECT = {
  id: true,
  bookDate: true,
  openPlayCapacity: true,
  court: {
    select: {
      id: true,
      name: true,
      venue: {
        select: {
          id: true,
          name: true,
          slug: true,
          city: true,
          timezone: true,
        },
      },
    },
  },
} satisfies Prisma.CourtBookingSelect;

/** Internal read for authorization and rules; mapped before leaving the service. */
const BOOKING_SELECT = {
  ...LISTING_SELECT,
  venueId: true,
  userId: true,
  isActive: true,
  isOpenPlay: true,
  isOpenPlayPublic: true,
  openPlayJoinToken: true,
  court: {
    select: {
      id: true,
      name: true,
      venue: {
        select: {
          id: true,
          tenantId: true,
          name: true,
          slug: true,
          city: true,
          timezone: true,
          status: true,
        },
      },
    },
  },
} satisfies Prisma.CourtBookingSelect;

type ListingRow = Prisma.CourtBookingGetPayload<{
  select: typeof LISTING_SELECT;
}>;
type BookingRow = Prisma.CourtBookingGetPayload<{
  select: typeof BOOKING_SELECT;
}>;

export type OpenPlayListingRecord = ListingRow & { confirmedSeats: number };
export type OpenPlayBookingRecord = BookingRow & { confirmedSeats: number };

export type OpenPlayListFilter = {
  now: Date;
  venueId?: string;
  from?: Date;
  to?: Date;
  skip: number;
  take: number;
};

export type BusyOutcome = { kind: 'BUSY' };
export type JoinSeatOutcome =
  | { kind: 'JOINED'; confirmedSeats: number; capacity: number }
  | { kind: 'FULL' }
  | { kind: 'ALREADY_SEATED' }
  | { kind: 'NOT_JOINABLE' }
  | BusyOutcome;
export type LeaveSeatOutcome =
  | { kind: 'LEFT' }
  | { kind: 'NO_SEAT' }
  | { kind: 'NOT_LEAVABLE' }
  | BusyOutcome;
export type CancelOutcome =
  | { kind: 'CANCELLED' }
  | { kind: 'OTHER_PLAYERS' }
  | { kind: 'NOT_CANCELLABLE' }
  | BusyOutcome;
export type EnableOutcome =
  | { kind: 'ENABLED' }
  | { kind: 'NOT_ENABLEABLE' }
  | BusyOutcome;

export type OpenPlayRosterRecord = {
  isBooker: boolean;
  createdAt: Date;
  user: { name: string };
};

@Injectable()
export class OpenPlayRepository {
  /**
   * Constructs the `OpenPlayRepository`.
   *
   * @param {PrismaService} prisma The Prisma service.
   */
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Lists publicly visible, joinable Open Play bookings, oldest start first.
   * The page and the total run as a plain `Promise.all` (an array
   * `$transaction` buys no consistency under READ COMMITTED). Seat counts
   * are fetched afterwards for just this page's ids.
   *
   * @param   {OpenPlayListFilter} filter Time, optional venue/range, page window.
   * @returns {Promise<{ records: OpenPlayListingRecord[]; total: number }>}
   */
  async listPublic(
    filter: OpenPlayListFilter,
  ): Promise<{ records: OpenPlayListingRecord[]; total: number }> {
    const bookDate: Prisma.DateTimeFilter<'CourtBooking'> = { gt: filter.now };
    if (filter.from) bookDate.gte = filter.from;
    if (filter.to) bookDate.lt = filter.to;

    const where: Prisma.CourtBookingWhereInput = {
      ...openPlayJoinableWhere(filter.now),
      bookDate,
      isOpenPlayPublic: true,
      ...(filter.venueId ? { venueId: filter.venueId } : {}),
    };

    const [rows, total] = await Promise.all([
      this.prisma.db.courtBooking.findMany({
        where,
        select: LISTING_SELECT,
        orderBy: [{ bookDate: 'asc' }, { id: 'asc' }],
        skip: filter.skip,
        take: filter.take,
      }),
      this.prisma.db.courtBooking.count({ where }),
    ]);

    const seats = await this.countSeats(rows.map((row) => row.id));
    return {
      records: rows.map((row) => ({
        ...row,
        confirmedSeats: seats.get(row.id) ?? 0,
      })),
      total,
    };
  }

  /**
   * Finds a booking (any kind, any state) by id, for the management routes,
   * which need precise 403/409 messages and must still see bookings at
   * non-ACTIVE venues.
   *
   * @param   {string} id The booking id.
   * @returns {Promise<OpenPlayBookingRecord | null>}
   */
  async findById(id: string): Promise<OpenPlayBookingRecord | null> {
    return this.withSeatCount(
      await this.prisma.db.courtBooking.findUnique({
        where: { id },
        select: BOOKING_SELECT,
      }),
    );
  }

  /**
   * Finds a booking by id only if it is viewable (see `openPlayViewableWhere`).
   *
   * @param   {string} id The booking id.
   * @returns {Promise<OpenPlayBookingRecord | null>}
   */
  async findViewableById(id: string): Promise<OpenPlayBookingRecord | null> {
    return this.withSeatCount(
      await this.prisma.db.courtBooking.findFirst({
        where: { id, ...openPlayViewableWhere() },
        select: BOOKING_SELECT,
      }),
    );
  }

  /**
   * Finds a booking by its join token only if it is viewable.
   *
   * @param   {string} token The join token.
   * @returns {Promise<OpenPlayBookingRecord | null>}
   */
  async findViewableByToken(
    token: string,
  ): Promise<OpenPlayBookingRecord | null> {
    return this.withSeatCount(
      await this.prisma.db.courtBooking.findFirst({
        where: { ...openPlayViewableWhere(), openPlayJoinToken: token },
        select: BOOKING_SELECT,
      }),
    );
  }

  /**
   * Finds a user's seat on a booking.
   *
   * @param   {string} bookingId The booking id.
   * @param   {string} userId    The user id.
   * @returns {Promise<{ isBooker: boolean } | null>}
   */
  async findSeat(
    bookingId: string,
    userId: string,
  ): Promise<{ isBooker: boolean } | null> {
    return this.prisma.db.openPlaySeat.findUnique({
      where: { bookingId_userId: { bookingId, userId } },
      select: { isBooker: true },
    });
  }

  /**
   * Lists a booking's roster, booker first, then by join time.
   *
   * @param   {string} bookingId The booking id.
   * @returns {Promise<OpenPlayRosterRecord[]>}
   */
  async findRoster(bookingId: string): Promise<OpenPlayRosterRecord[]> {
    return this.prisma.db.openPlaySeat.findMany({
      where: { bookingId },
      select: {
        isBooker: true,
        createdAt: true,
        user: { select: { name: true } },
      },
      orderBy: [{ isBooker: 'desc' }, { createdAt: 'asc' }],
    });
  }

  /**
   * Reserves a seat. Concurrency-safe: the conditional `updateMany` takes a
   * row lock on the booking (held until commit), so concurrent joins on one
   * booking serialize, and under READ COMMITTED each later statement sees
   * seats committed by the previous lock holder. The lock's `where` is
   * scalar-only; the full joinable builder (venue status included) is
   * re-checked by a `findFirst` right after, while the row is locked. The
   * capacity check lives here, not in the service, because it must run
   * under that lock.
   *
   * @param   {{ bookingId: string; userId: string; now: Date; requirePublic: boolean }} args
   * @returns {Promise<JoinSeatOutcome>}
   */
  async joinSeat(args: {
    bookingId: string;
    userId: string;
    now: Date;
    requirePublic: boolean;
  }): Promise<JoinSeatOutcome> {
    const { bookingId, userId, now, requirePublic } = args;
    const publicOnly = requirePublic ? { isOpenPlayPublic: true } : {};

    return this.runSeatTransaction<JoinSeatOutcome>(
      async (tx) => {
        const locked = await tx.courtBooking.updateMany({
          where: {
            id: bookingId,
            ...openPlayLiveScalars(),
            bookDate: { gt: now },
            ...publicOnly,
          },
          data: { updatedAt: now },
        });
        if (locked.count === 0) return { kind: 'NOT_JOINABLE' } as const;

        const booking = await tx.courtBooking.findFirst({
          where: {
            id: bookingId,
            ...openPlayJoinableWhere(now),
            ...publicOnly,
          },
          select: { openPlayCapacity: true },
        });
        if (booking === null || booking.openPlayCapacity === null) {
          return { kind: 'NOT_JOINABLE' } as const;
        }

        const existing = await tx.openPlaySeat.findUnique({
          where: { bookingId_userId: { bookingId, userId } },
          select: { id: true },
        });
        if (existing) return { kind: 'ALREADY_SEATED' } as const;

        const capacity = booking.openPlayCapacity;
        const confirmed = await tx.openPlaySeat.count({ where: { bookingId } });
        if (isFull(confirmed, capacity)) return { kind: 'FULL' } as const;

        await tx.openPlaySeat.create({
          data: { bookingId, userId, isBooker: false },
        });
        return {
          kind: 'JOINED',
          confirmedSeats: confirmed + 1,
          capacity,
        } as const;
      },
      { P2002: { kind: 'ALREADY_SEATED' }, P2003: { kind: 'NOT_JOINABLE' } },
    );
  }

  /**
   * Releases a non-booker seat, only while the booking starts at or after
   * `now + 24h`. Locks the booking like `joinSeat`.
   *
   * @param   {{ bookingId: string; userId: string; now: Date }} args
   * @returns {Promise<LeaveSeatOutcome>}
   */
  async leaveSeat(args: {
    bookingId: string;
    userId: string;
    now: Date;
  }): Promise<LeaveSeatOutcome> {
    const { bookingId, userId, now } = args;

    return this.runSeatTransaction<LeaveSeatOutcome>(async (tx) => {
      const locked = await tx.courtBooking.updateMany({
        where: {
          id: bookingId,
          isOpenPlay: true,
          isActive: true,
          bookDate: { gte: latestLeaveableStart(now) },
        },
        data: { updatedAt: now },
      });
      if (locked.count === 0) return { kind: 'NOT_LEAVABLE' } as const;

      const deleted = await tx.openPlaySeat.deleteMany({
        where: { bookingId, userId, isBooker: false },
      });
      return deleted.count > 0
        ? ({ kind: 'LEFT' } as const)
        : ({ kind: 'NO_SEAT' } as const);
    });
  }

  /**
   * Soft-cancels an Open Play booking and frees its schedule rows
   * (`isActive: false, isVacant: true`). Inside the 24h window this is
   * refused while any non-booker seat exists. Locks the booking like
   * `joinSeat`, so it cannot race a join.
   *
   * @param   {{ bookingId: string; bookerId: string; now: Date }} args
   * @returns {Promise<CancelOutcome>}
   */
  async cancelBooking(args: {
    bookingId: string;
    bookerId: string;
    now: Date;
  }): Promise<CancelOutcome> {
    const { bookingId, bookerId, now } = args;

    return this.runSeatTransaction<CancelOutcome>(async (tx) => {
      const locked = await tx.courtBooking.updateMany({
        where: {
          id: bookingId,
          isOpenPlay: true,
          isActive: true,
          userId: bookerId,
          bookDate: { gt: now },
        },
        data: { updatedAt: now },
      });
      if (locked.count === 0) return { kind: 'NOT_CANCELLABLE' } as const;

      const booking = await tx.courtBooking.findUniqueOrThrow({
        where: { id: bookingId },
        select: { bookDate: true, courtId: true, referenceId: true },
      });

      if (isInsideCutoff(booking.bookDate, now)) {
        const others = await tx.openPlaySeat.count({
          where: { bookingId, isBooker: false },
        });
        if (others > 0) return { kind: 'OTHER_PLAYERS' } as const;
      }

      await tx.courtBooking.update({
        where: { id: bookingId },
        data: { isActive: false },
      });
      await tx.courtSchedule.updateMany({
        where: { referenceId: booking.referenceId, courtId: booking.courtId },
        data: { isActive: false, isVacant: true },
      });
      return { kind: 'CANCELLED' } as const;
    });
  }

  /**
   * Turns an existing private booking into Open Play and seats its booker.
   *
   * @param   {{ bookingId: string; now: Date; capacity: number; isPublic: boolean; token: string }} args
   * @returns {Promise<EnableOutcome>}
   */
  async enableOpenPlay(args: {
    bookingId: string;
    now: Date;
    capacity: number;
    isPublic: boolean;
    token: string;
  }): Promise<EnableOutcome> {
    const { bookingId, now, capacity, isPublic, token } = args;

    return this.runSeatTransaction<EnableOutcome>(
      async (tx) => {
        const locked = await tx.courtBooking.updateMany({
          where: {
            id: bookingId,
            isOpenPlay: false,
            isActive: true,
            userId: { not: null },
            bookDate: { gt: now },
          },
          data: { updatedAt: now },
        });
        if (locked.count === 0) return { kind: 'NOT_ENABLEABLE' } as const;

        const { userId } = await tx.courtBooking.findUniqueOrThrow({
          where: { id: bookingId },
          select: { userId: true },
        });
        if (userId === null) return { kind: 'NOT_ENABLEABLE' } as const;

        await tx.courtBooking.update({
          where: { id: bookingId },
          data: {
            isOpenPlay: true,
            openPlayCapacity: capacity,
            isOpenPlayPublic: isPublic,
            openPlayJoinToken: token,
          },
        });
        await tx.openPlaySeat.create({
          data: { bookingId, userId, isBooker: true },
        });
        return { kind: 'ENABLED' } as const;
      },
      { P2002: { kind: 'NOT_ENABLEABLE' }, P2003: { kind: 'NOT_ENABLEABLE' } },
    );
  }

  /**
   * Sets the public-listing flag on an active Open Play booking.
   *
   * @param   {string}  bookingId The booking id.
   * @param   {boolean} isPublic  The new flag.
   * @returns {Promise<boolean>}  `false` if the booking no longer qualifies.
   */
  async setVisibility(bookingId: string, isPublic: boolean): Promise<boolean> {
    const result = await this.prisma.db.courtBooking.updateMany({
      where: { id: bookingId, isOpenPlay: true, isActive: true },
      data: { isOpenPlayPublic: isPublic },
    });
    return result.count > 0;
  }

  /**
   * Runs one interactive seat transaction with explicit bounds and turns
   * known Prisma/Postgres failures into outcomes, so none surfaces as a raw
   * 500: `P2002`/`P2003` map to the caller's outcome (when given),
   * timeouts/conflicts/deadlocks map to `BUSY`, anything else is rethrown.
   *
   * @param   {(tx: Prisma.TransactionClient) => Promise<T>} work The transaction body.
   * @param   {{ P2002?: T; P2003?: T }} onConstraint Outcomes for constraint violations.
   * @returns {Promise<T | BusyOutcome>}
   * @throws  {unknown} Any error that isn't mapped.
   */
  private async runSeatTransaction<T extends { kind: string }>(
    work: (tx: Prisma.TransactionClient) => Promise<T>,
    onConstraint: { P2002?: T; P2003?: T } = {},
  ): Promise<T | BusyOutcome> {
    try {
      return await this.prisma.db.$transaction(work, INTERACTIVE_TX_OPTIONS);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2002' && onConstraint.P2002)
          return onConstraint.P2002;
        if (error.code === 'P2003' && onConstraint.P2003)
          return onConstraint.P2003;
      }
      if (isRetryableTransactionError(error)) return { kind: 'BUSY' };
      throw error;
    }
  }

  /** Seat counts for a page of bookings, in one `groupBy` scoped to those ids. */
  private async countSeats(bookingIds: string[]): Promise<Map<string, number>> {
    if (bookingIds.length === 0) return new Map();
    const groups = await this.prisma.db.openPlaySeat.groupBy({
      by: ['bookingId'],
      where: { bookingId: { in: bookingIds } },
      _count: { _all: true },
    });
    return new Map(groups.map((group) => [group.bookingId, group._count._all]));
  }

  /** Attaches `confirmedSeats` to a single booking row with an index-scoped count. */
  private async withSeatCount(
    row: BookingRow | null,
  ): Promise<OpenPlayBookingRecord | null> {
    if (row === null) return null;
    const confirmedSeats = await this.prisma.db.openPlaySeat.count({
      where: { bookingId: row.id },
    });
    return { ...row, confirmedSeats };
  }
}
