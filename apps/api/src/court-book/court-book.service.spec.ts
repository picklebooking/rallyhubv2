import { jest } from '@jest/globals';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import type { Court } from '../generated/prisma/client';
import { CourtsRepository } from '../courts/courts.repository';
import { DateTimeHelper } from '../helper/date-time.helper';
import { OpenPlayTokenHelper } from '../helper/open-play-token.helper';
import { PNRHelper } from '../helper/pnr.helper';
import { CourtBookRepository } from './court-book.repository';
import { CourtBookService } from './court-book.service';

function createMockCourt(overrides: Partial<Court> = {}): Court {
  return {
    id: 'court-1',
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
  let tokenHelper: jest.Mocked<OpenPlayTokenHelper>;

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

    tokenHelper = {
      generate: jest.fn(),
    } as unknown as jest.Mocked<OpenPlayTokenHelper>;
    tokenHelper.generate.mockReturnValue('tok_abcdefghijklmnopqrstuvwxyz0123');

    service = new CourtBookService(
      repository,
      courtsRepository,
      dateTimeHelper,
      pnrHelper,
      tokenHelper,
    );
  });

  it('checks for conflicts on the court id', async () => {
    repository.hasConflictBooking.mockResolvedValue(false);
    repository.findUserIdByEmail.mockResolvedValue('user-1');
    repository.createCourtBooking.mockResolvedValue('booking-1');

    await service.createBookingRoute('venue-1', payload, payload.email);

    expect(repository.hasConflictBooking).toHaveBeenCalledWith(
      'court-1',
      newDateTime,
      payload.date,
    );
  });

  it('throws ConflictException when a conflicting booking exists', async () => {
    repository.hasConflictBooking.mockResolvedValue(true);

    await expect(
      service.createBookingRoute('venue-1', payload, payload.email),
    ).rejects.toThrow(ConflictException);
    expect(repository.findUserIdByEmail).not.toHaveBeenCalled();
  });

  it('throws NotFoundException when no user matches the email', async () => {
    repository.hasConflictBooking.mockResolvedValue(false);
    repository.findUserIdByEmail.mockResolvedValue(null);

    await expect(
      service.createBookingRoute('venue-1', payload, payload.email),
    ).rejects.toThrow(NotFoundException);
    expect(repository.createCourtBooking).not.toHaveBeenCalled();
  });

  it('throws NotFoundException when the court does not exist', async () => {
    courtsRepository.findById.mockResolvedValue(null);

    await expect(
      service.createBookingRoute('venue-1', payload, payload.email),
    ).rejects.toThrow(NotFoundException);
    expect(repository.hasConflictBooking).not.toHaveBeenCalled();
  });

  it('throws NotFoundException when the court belongs to a different venue', async () => {
    courtsRepository.findById.mockResolvedValue(
      createMockCourt({ venueId: 'other-venue' }),
    );

    await expect(
      service.createBookingRoute('venue-1', payload, payload.email),
    ).rejects.toThrow(NotFoundException);
    expect(repository.hasConflictBooking).not.toHaveBeenCalled();
  });

  it('passes the resolved venueId into both booking and schedule records', async () => {
    repository.hasConflictBooking.mockResolvedValue(false);
    repository.findUserIdByEmail.mockResolvedValue('user-1');
    repository.createCourtBooking.mockResolvedValue('booking-1');

    await service.createBookingRoute('venue-1', payload, payload.email);

    expect(repository.createCourtBooking).toHaveBeenCalledTimes(1);
    const [schedule, booking] = repository.createCourtBooking.mock.calls[0];

    expect(schedule.venueId).toBe('venue-1');
    expect(booking.venueId).toBe('venue-1');
    expect(booking.referenceId).toBe('PNR123');
  });

  describe('open play at creation', () => {
    beforeEach(() => {
      repository.hasConflictBooking.mockResolvedValue(false);
      repository.findUserIdByEmail.mockResolvedValue('user-1');
      repository.createCourtBooking.mockResolvedValue('booking-1');
    });

    it('defaults capacity to 4, private, with a token, and returns the token and booking id', async () => {
      const result = await service.createBookingRoute(
        'venue-1',
        { ...payload, isOpenPlay: true },
        payload.email,
      );

      const [, booking] = repository.createCourtBooking.mock.calls[0];
      expect(booking.isOpenPlay).toBe(true);
      expect(booking.openPlayCapacity).toBe(4);
      expect(booking.isOpenPlayPublic).toBe(false);
      expect(booking.openPlayJoinToken).toBe(
        'tok_abcdefghijklmnopqrstuvwxyz0123',
      );
      expect(result.openPlayJoinToken).toBe(
        'tok_abcdefghijklmnopqrstuvwxyz0123',
      );
      expect(result.bookingId).toBe('booking-1');
    });

    it('keeps an explicit capacity and public flag', async () => {
      await service.createBookingRoute(
        'venue-1',
        {
          ...payload,
          isOpenPlay: true,
          openPlayCapacity: 6,
          isOpenPlayPublic: true,
        },
        payload.email,
      );

      const [, booking] = repository.createCourtBooking.mock.calls[0];
      expect(booking.openPlayCapacity).toBe(6);
      expect(booking.isOpenPlayPublic).toBe(true);
    });

    it("rejects an open play booking for someone else's email with 400", async () => {
      await expect(
        service.createBookingRoute(
          'venue-1',
          { ...payload, isOpenPlay: true },
          'someone-else@example.com',
        ),
      ).rejects.toThrow(BadRequestException);
      expect(repository.createCourtBooking).not.toHaveBeenCalled();
      expect(tokenHelper.generate).not.toHaveBeenCalled();
    });

    it('treats the email match as case-insensitive', async () => {
      await service.createBookingRoute(
        'venue-1',
        { ...payload, isOpenPlay: true, email: 'Player@Example.com' },
        'player@example.com',
      );
      expect(repository.createCourtBooking).toHaveBeenCalledTimes(1);
    });

    it('does not check the email on a private booking (general gap stays deferred)', async () => {
      await service.createBookingRoute(
        'venue-1',
        payload,
        'someone-else@example.com',
      );
      expect(repository.createCourtBooking).toHaveBeenCalledTimes(1);
    });

    it.each([{ openPlayCapacity: 4 }, { isOpenPlayPublic: true }])(
      'rejects %p on a private booking with 400',
      async (extra) => {
        await expect(
          service.createBookingRoute(
            'venue-1',
            { ...payload, ...extra },
            payload.email,
          ),
        ).rejects.toThrow(BadRequestException);
        expect(repository.createCourtBooking).not.toHaveBeenCalled();
      },
    );

    it('allows isOpenPlayPublic: false on a private booking', async () => {
      await service.createBookingRoute(
        'venue-1',
        { ...payload, isOpenPlayPublic: false },
        payload.email,
      );
      expect(repository.createCourtBooking).toHaveBeenCalledTimes(1);
    });

    it('leaves a private booking unchanged: no token, no capacity, no booking id in the response', async () => {
      const result = await service.createBookingRoute(
        'venue-1',
        payload,
        payload.email,
      );

      const [, booking] = repository.createCourtBooking.mock.calls[0];
      expect(booking.openPlayCapacity).toBeNull();
      expect(booking.openPlayJoinToken).toBeNull();
      expect(booking.isOpenPlayPublic).toBe(false);
      expect(tokenHelper.generate).not.toHaveBeenCalled();
      expect(result.openPlayJoinToken).toBeUndefined();
      expect(result.bookingId).toBeUndefined();
    });
  });
});
