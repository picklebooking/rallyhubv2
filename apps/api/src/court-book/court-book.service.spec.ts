import { jest } from '@jest/globals';
import { ConflictException, NotFoundException } from '@nestjs/common';
import type { Court } from '../generated/prisma/client';
import {
  CreateCourtBooking,
  CreateCourtSchedule,
} from '../models/create-booking.model';
import { CourtsRepository } from '../courts/courts.repository';
import { DateTimeHelper } from '../helper/date-time.helper';
import { PNRHelper } from '../helper/pnr.helper';
import { CourtBookRepository } from './court-book.repository';
import { CourtBookService } from './court-book.service';

function createMockCourt(overrides: Partial<Court> = {}): Court {
  return {
    id: 'court-1',
    tenantId: 'tenant-1',
    venueId: 'venue-1',
    name: 'Court 1',
    status: 'ACTIVE',
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    ...overrides,
  };
}

describe('CourtBookService', () => {
  let service: CourtBookService;
  let repository: jest.Mocked<CourtBookRepository>;
  let courtsRepository: jest.Mocked<CourtsRepository>;
  let dateTimeHelper: jest.Mocked<DateTimeHelper>;
  let pnrHelper: jest.Mocked<PNRHelper>;

  const payload = {
    date: '2026-06-01T10:00:00.000Z',
    email: 'player@example.com',
    courtId: 'court-1',
    rentDuration: 2,
    isOpenPlay: false,
  };
  const newDateTime = new Date('2026-06-01T12:00:00.000Z');

  beforeEach(() => {
    repository = {
      hasConflictBooking: jest.fn(),
      findUserIdByEmail: jest.fn(),
      createCourtBooking: jest.fn(),
    } as unknown as jest.Mocked<CourtBookRepository>;

    courtsRepository = {
      findAllByVenue: jest.fn(),
      findById: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    } as unknown as jest.Mocked<CourtsRepository>;
    courtsRepository.findById.mockResolvedValue(createMockCourt());

    dateTimeHelper = {
      addHoursToCurrentDateTime: jest.fn(),
    } as unknown as jest.Mocked<DateTimeHelper>;
    dateTimeHelper.addHoursToCurrentDateTime.mockReturnValue(newDateTime);

    pnrHelper = {
      generateUniqueRefId: jest.fn(),
    } as unknown as jest.Mocked<PNRHelper>;
    pnrHelper.generateUniqueRefId.mockResolvedValue('PNR123');

    service = new CourtBookService(
      repository,
      courtsRepository,
      dateTimeHelper,
      pnrHelper,
    );
  });

  it('checks for conflicts using the resolved tenantId, not one from the payload', async () => {
    repository.hasConflictBooking.mockResolvedValue(false);
    repository.findUserIdByEmail.mockResolvedValue('user-1');
    repository.createCourtBooking.mockResolvedValue(undefined);

    await service.createBookingRoute('tenant-1', 'venue-1', payload);

    expect(repository.hasConflictBooking).toHaveBeenCalledWith(
      'tenant-1',
      'court-1',
      newDateTime,
      payload.date,
    );
  });

  it('throws ConflictException when a conflicting booking exists', async () => {
    repository.hasConflictBooking.mockResolvedValue(true);

    await expect(
      service.createBookingRoute('tenant-1', 'venue-1', payload),
    ).rejects.toThrow(ConflictException);
    expect(repository.findUserIdByEmail).not.toHaveBeenCalled();
  });

  it('throws NotFoundException when no user matches the email', async () => {
    repository.hasConflictBooking.mockResolvedValue(false);
    repository.findUserIdByEmail.mockResolvedValue(null);

    await expect(
      service.createBookingRoute('tenant-1', 'venue-1', payload),
    ).rejects.toThrow(NotFoundException);
    expect(repository.createCourtBooking).not.toHaveBeenCalled();
  });

  it('throws NotFoundException when the court does not exist', async () => {
    courtsRepository.findById.mockResolvedValue(null);

    await expect(
      service.createBookingRoute('tenant-1', 'venue-1', payload),
    ).rejects.toThrow(NotFoundException);
    expect(repository.hasConflictBooking).not.toHaveBeenCalled();
  });

  it('throws NotFoundException when the court belongs to a different venue', async () => {
    courtsRepository.findById.mockResolvedValue(
      createMockCourt({ venueId: 'other-venue' }),
    );

    await expect(
      service.createBookingRoute('tenant-1', 'venue-1', payload),
    ).rejects.toThrow(NotFoundException);
    expect(repository.hasConflictBooking).not.toHaveBeenCalled();
  });

  it('passes the resolved tenantId and venueId into both booking and schedule records', async () => {
    repository.hasConflictBooking.mockResolvedValue(false);
    repository.findUserIdByEmail.mockResolvedValue('user-1');
    repository.createCourtBooking.mockResolvedValue(undefined);

    await service.createBookingRoute('tenant-1', 'venue-1', payload);

    expect(repository.createCourtBooking).toHaveBeenCalledTimes(1);
    const [schedule, booking] = repository.createCourtBooking.mock
      .calls[0] as [CreateCourtSchedule, CreateCourtBooking];

    expect(schedule.tenantId).toBe('tenant-1');
    expect(schedule.venueId).toBe('venue-1');
    expect(booking.tenantId).toBe('tenant-1');
    expect(booking.venueId).toBe('venue-1');
    expect(booking.referenceId).toBe('PNR123');
  });
});
