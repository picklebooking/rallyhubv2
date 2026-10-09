import { jest } from '@jest/globals';
import type { PrismaClient as PrismaClientType } from '../generated/prisma/client';
import { CreateCourtBooking, CreateCourtSchedule } from '../models/create-booking.model';
import type { PrismaService } from '../prisma/prisma.service';
import { CourtBookRepository } from './court-book.repository';

type MockFn = ReturnType<typeof jest.fn>;

function createMockPrismaService(): PrismaService {
  return {
    db: {
      courtSchedule: { findFirst: jest.fn(), create: jest.fn() },
      courtBooking: { create: jest.fn() },
      // Array form: resolves to [schedule, booking] like the real client.
      $transaction: jest.fn(async () => [{ id: 'schedule-1' }, { id: 'booking-1' }]),
    } as unknown as PrismaClientType,
  } as PrismaService;
}

const schedule = new CreateCourtSchedule(
  '2026-11-01T10:00:00.000Z', 'court-1', 'p@example.com', 'user-1',
  new Date('2026-11-01T12:00:00.000Z'), 2, 'venue-1', false, true, 'RH-ABC123',
);

describe('CourtBookRepository', () => {
  let prismaService: PrismaService;
  let repository: CourtBookRepository;

  beforeEach(() => {
    prismaService = createMockPrismaService();
    repository = new CourtBookRepository(prismaService);
  });

  it('hasConflictBooking only counts occupied (isVacant: false) schedules', async () => {
    (prismaService.db.courtSchedule.findFirst as MockFn).mockResolvedValue(null);
    const end = new Date('2026-11-01T12:00:00.000Z');

    await repository.hasConflictBooking('court-1', end, '2026-11-01T10:00:00.000Z');

    // Filter on the non-nullable isVacant, never `NOT: { isActive: false }`:
    // CourtSchedule.isActive is Boolean?, and NOT(NULL) is NULL in SQL, so a
    // NULL-isActive row would silently stop blocking its slot.
    expect(prismaService.db.courtSchedule.findFirst).toHaveBeenCalledWith({
      where: {
        courtId: 'court-1',
        bookedDate: { lt: end },
        dateTimeVacant: { gt: '2026-11-01T10:00:00.000Z' },
        isVacant: false,
      },
    });
  });

  it('creates the booker seat as a nested create for open play bookings and returns the booking id', async () => {
    const booking = new CreateCourtBooking(
      '2026-11-01T10:00:00.000Z', 'p@example.com', 'user-1', 'venue-1', 'court-1',
      true, 'RH-ABC123', true, null, false, 4, false, 'tok',
    );

    const id = await repository.createCourtBooking(schedule, booking);

    expect(id).toBe('booking-1');
    expect(prismaService.db.courtBooking.create).toHaveBeenCalledWith({
      data: {
        ...booking,
        openPlaySeats: { create: { userId: 'user-1', isBooker: true } },
      },
      select: { id: true },
    });
  });

  it('creates no seat for private bookings', async () => {
    const booking = new CreateCourtBooking(
      '2026-11-01T10:00:00.000Z', 'p@example.com', 'user-1', 'venue-1', 'court-1',
      true, 'RH-ABC123', false,
    );

    await repository.createCourtBooking(schedule, booking);

    expect(prismaService.db.courtBooking.create).toHaveBeenCalledWith({
      data: { ...booking },
      select: { id: true },
    });
  });
});
