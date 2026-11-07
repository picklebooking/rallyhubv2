import { Injectable } from '@nestjs/common';
import type { Prisma } from '../generated/prisma/client';
import type {
  CreateCourtBooking,
  CreateCourtSchedule,
} from '../models/create-booking.model';
import { PrismaService } from '../prisma/prisma.service';
import {
  INTERACTIVE_TX_OPTIONS,
  isRetryableTransactionError,
} from '../prisma/interactive-transaction';
import { bookableCourtWhere } from '../courts/court-bookability';
import {
  bookingRulesFromRecord,
  evaluateBookingRules,
  isValidTimeZone,
  type BookingRuleViolation,
} from './booking-rules';

export function occupiedOverlapWhere(
  courtId: string,
  start: Date,
  end: Date,
): Prisma.CourtScheduleWhereInput {
  return {
    courtId,
    bookedDate: { lt: end },
    dateTimeVacant: { gt: start },
    isVacant: false,
  };
}

export type ReserveCourtOutcome =
  | { kind: 'CREATED'; bookingId: string }
  | { kind: 'COURT_NOT_BOOKABLE' }
  | { kind: 'SLOT_TAKEN' }
  | { kind: 'BUSY' }
  | { kind: 'RULE_VIOLATION'; code: BookingRuleViolation };

/** Throw inside the callback so a rejection also rolls back the court lock update. */
class ReservationRejected extends Error {
  constructor(
    readonly outcome: Extract<
      ReserveCourtOutcome,
      { kind: 'RULE_VIOLATION' | 'COURT_NOT_BOOKABLE' }
    >,
  ) {
    super(outcome.kind);
  }
}

@Injectable()
export class CourtBookRepository {
  constructor(private readonly prismaService: PrismaService) {}

  /**
   * Serialize occupancy writes on the court row and recheck acceptance under
   * that lock. Any future write path that occupies a schedule must go through
   * this method.
   */
  public async reserveCourt(args: {
    schedule: CreateCourtSchedule;
    booking: CreateCourtBooking;
    now: Date;
  }): Promise<ReserveCourtOutcome> {
    const { schedule, booking, now } = args;
    try {
      return await this.prismaService.db.$transaction(
        async (tx): Promise<ReserveCourtOutcome> => {
          const locked = await tx.court.updateMany({
            where: {
              id: schedule.courtId,
              venueId: schedule.venueId,
              status: 'ACTIVE',
            },
            data: { updatedAt: now },
          });
          if (locked.count === 0) return { kind: 'COURT_NOT_BOOKABLE' };
          const court = await tx.court.findFirst({
            where: { id: schedule.courtId, ...bookableCourtWhere() },
            select: {
              venue: {
                select: {
                  timezone: true,
                  bookingSettings: {
                    select: {
                      minDurationHours: true,
                      maxDurationHours: true,
                      horizonDays: true,
                      startAlignment: true,
                      openingHours: {
                        select: {
                          weekday: true,
                          opensAtMinute: true,
                          closesAtMinute: true,
                        },
                      },
                    },
                  },
                },
              },
            },
          });
          if (!court) return { kind: 'COURT_NOT_BOOKABLE' };
          if (!isValidTimeZone(court.venue.timezone)) {
            throw new ReservationRejected({ kind: 'COURT_NOT_BOOKABLE' });
          }
          const code = evaluateBookingRules({
            start: schedule.bookedDate,
            durationHours: schedule.hoursBooked,
            now,
            timeZone: court.venue.timezone,
            rules: bookingRulesFromRecord(court.venue.bookingSettings),
          });
          if (code)
            throw new ReservationRejected({ kind: 'RULE_VIOLATION', code });
          const overlaps = await tx.courtSchedule.count({
            where: occupiedOverlapWhere(
              schedule.courtId,
              schedule.bookedDate,
              schedule.dateTimeVacant,
            ),
          });
          if (overlaps > 0) return { kind: 'SLOT_TAKEN' };
          await tx.courtSchedule.create({ data: schedule });
          const created = await tx.courtBooking.create({
            data: booking.isOpenPlay
              ? {
                  ...booking,
                  openPlaySeats: {
                    create: { userId: booking.userId, isBooker: true },
                  },
                }
              : { ...booking },
            select: { id: true },
          });
          return { kind: 'CREATED', bookingId: created.id };
        },
        INTERACTIVE_TX_OPTIONS,
      );
    } catch (error: unknown) {
      if (error instanceof ReservationRejected) return error.outcome;
      if (isRetryableTransactionError(error)) return { kind: 'BUSY' };
      throw error;
    }
  }
}
