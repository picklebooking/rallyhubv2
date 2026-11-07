import { jest } from '@jest/globals';
import { Prisma } from '../generated/prisma/client';
import {
  CreateCourtBooking,
  CreateCourtSchedule,
} from '../models/create-booking.model';
import type { PrismaService } from '../prisma/prisma.service';
import { INTERACTIVE_TX_OPTIONS } from '../prisma/interactive-transaction';
import { bookableCourtWhere } from '../courts/court-bookability';
import {
  CourtBookRepository,
  occupiedOverlapWhere,
} from './court-book.repository';

describe('CourtBookRepository reserveCourt', () => {
  const now = new Date('2026-11-07T00:00:00Z');
  const start = new Date('2026-11-08T02:00:00Z');
  const end = new Date(+start + 3_600_000);
  const schedule = new CreateCourtSchedule(
    start,
    'court',
    'p@example.com',
    'caller',
    end,
    1,
    'venue',
    false,
    true,
    'REF',
  );
  const booking = new CreateCourtBooking(
    start,
    'p@example.com',
    'caller',
    'venue',
    'court',
    true,
    'REF',
    true,
    null,
    false,
    4,
    false,
    'token',
  );
  type CourtRuleRead = {
    id: string;
    venue: { timezone: string; bookingSettings: null };
  };
  const tx = {
    court: {
      updateMany: jest.fn<() => Promise<{ count: number }>>(),
      findFirst: jest.fn<() => Promise<CourtRuleRead | null>>(),
    },
    courtSchedule: {
      count: jest.fn<() => Promise<number>>(),
      create: jest.fn<() => Promise<{ id: string }>>(),
    },
    courtBooking: { create: jest.fn<() => Promise<{ id: string }>>() },
  };
  const transaction =
    jest.fn<
      (
        work: (client: typeof tx) => Promise<unknown>,
        options: typeof INTERACTIVE_TX_OPTIONS,
      ) => Promise<unknown>
    >();
  let repository: CourtBookRepository;
  beforeEach(() => {
    jest.clearAllMocks();
    tx.court.updateMany.mockResolvedValue({ count: 1 });
    tx.court.findFirst.mockResolvedValue({
      id: 'court',
      venue: { timezone: 'Asia/Manila', bookingSettings: null },
    });
    tx.courtSchedule.count.mockResolvedValue(0);
    tx.courtSchedule.create.mockResolvedValue({ id: 'schedule' });
    tx.courtBooking.create.mockResolvedValue({ id: 'booking' });
    transaction.mockImplementation((work) => work(tx));
    repository = new CourtBookRepository({
      db: { $transaction: transaction },
    } as unknown as PrismaService);
  });
  it('locks with scalars, rechecks bookability, then overlap, then inserts both rows and booker seat', async () => {
    expect(await repository.reserveCourt({ schedule, booking, now })).toEqual({
      kind: 'CREATED',
      bookingId: 'booking',
    });
    expect(transaction).toHaveBeenCalledWith(
      expect.any(Function),
      INTERACTIVE_TX_OPTIONS,
    );
    expect(tx.court.updateMany).toHaveBeenCalledWith({
      where: { id: 'court', venueId: 'venue', status: 'ACTIVE' },
      data: { updatedAt: now },
    });
    expect(tx.court.findFirst).toHaveBeenCalledWith({
      where: { id: 'court', ...bookableCourtWhere() },
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
    expect(tx.courtSchedule.count).toHaveBeenCalledWith({
      where: occupiedOverlapWhere('court', start, end),
    });
    expect(occupiedOverlapWhere('court', start, end)).toEqual({
      courtId: 'court',
      bookedDate: { lt: end },
      dateTimeVacant: { gt: start },
      isVacant: false,
    });
    expect(tx.courtSchedule.create).toHaveBeenCalledWith({ data: schedule });
    expect(tx.courtBooking.create).toHaveBeenCalledWith({
      data: {
        ...booking,
        openPlaySeats: { create: { userId: 'caller', isBooker: true } },
      },
      select: { id: true },
    });
    const calls = [
      tx.court.updateMany,
      tx.court.findFirst,
      tx.courtSchedule.count,
      tx.courtSchedule.create,
      tx.courtBooking.create,
    ].map((fn) => fn.mock.invocationCallOrder[0]);
    expect(calls).toEqual([...calls].sort((a, b) => a - b));
  });
  it('returns not bookable when the scalar update has count zero', async () => {
    tx.court.updateMany.mockResolvedValue({ count: 0 });
    expect(await repository.reserveCourt({ schedule, booking, now })).toEqual({
      kind: 'COURT_NOT_BOOKABLE',
    });
    expect(tx.court.findFirst).not.toHaveBeenCalled();
    expect(tx.courtSchedule.create).not.toHaveBeenCalled();
  });
  it('returns not bookable when the under-lock policy read is null', async () => {
    tx.court.findFirst.mockResolvedValue(null);
    expect(await repository.reserveCourt({ schedule, booking, now })).toEqual({
      kind: 'COURT_NOT_BOOKABLE',
    });
    expect(tx.courtSchedule.count).not.toHaveBeenCalled();
    expect(tx.courtSchedule.create).not.toHaveBeenCalled();
  });
  it('rejects occupied overlaps without writing', async () => {
    tx.courtSchedule.count.mockResolvedValue(1);
    expect(await repository.reserveCourt({ schedule, booking, now })).toEqual({
      kind: 'SLOT_TAKEN',
    });
    expect(tx.courtSchedule.create).not.toHaveBeenCalled();
    expect(tx.courtBooking.create).not.toHaveBeenCalled();
  });
  it('creates no seat for a private booking', async () => {
    const privateBooking = { ...booking, isOpenPlay: false };
    await repository.reserveCourt({ schedule, booking: privateBooking, now });
    expect(tx.courtBooking.create).toHaveBeenCalledWith({
      data: privateBooking,
      select: { id: true },
    });
  });
  it('fails closed on an invalid stored timezone before overlap or inserts', async () => {
    tx.court.findFirst.mockResolvedValue({
      id: 'court',
      venue: { timezone: 'Not/AZone', bookingSettings: null },
    });
    expect(await repository.reserveCourt({ schedule, booking, now })).toEqual({
      kind: 'COURT_NOT_BOOKABLE',
    });
    expect(tx.courtSchedule.count).not.toHaveBeenCalled();
    expect(tx.courtSchedule.create).not.toHaveBeenCalled();
    expect(tx.courtBooking.create).not.toHaveBeenCalled();
  });
  it('rejects rules before overlap and inserts', async () => {
    const pastSchedule = {
      ...schedule,
      bookedDate: new Date(+now - 3_600_000),
    };
    tx.courtSchedule.count.mockResolvedValue(1);
    expect(
      await repository.reserveCourt({ schedule: pastSchedule, booking, now }),
    ).toEqual({ kind: 'RULE_VIOLATION', code: 'START_IN_PAST' });
    expect(tx.courtSchedule.count).not.toHaveBeenCalled();
    expect(tx.courtSchedule.create).not.toHaveBeenCalled();
    expect(tx.courtBooking.create).not.toHaveBeenCalled();
  });
  it('maps retryable contention to BUSY', async () => {
    transaction.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('conflict', {
        code: 'P2034',
        clientVersion: '7',
      }),
    );
    expect(await repository.reserveCourt({ schedule, booking, now })).toEqual({
      kind: 'BUSY',
    });
  });
  it('rethrows other errors', async () => {
    const error = new Error('database unavailable');
    transaction.mockRejectedValue(error);
    await expect(
      repository.reserveCourt({ schedule, booking, now }),
    ).rejects.toBe(error);
  });
});
