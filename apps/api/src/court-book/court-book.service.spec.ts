import { jest } from '@jest/globals';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import type { Court } from '../generated/prisma/client';
import { ErrorConstant } from '../constants/error-code.constant';
import { CourtsRepository } from '../courts/courts.repository';
import { OpenPlayTokenHelper } from '../helper/open-play-token.helper';
import { PNRHelper } from '../helper/pnr.helper';
import { CourtBookRepository } from './court-book.repository';
import { CourtBookService } from './court-book.service';

describe('CourtBookService', () => {
  const owner = { id: 'caller', email: 'caller@example.com' };
  const payload = {
    date: '2026-11-08T02:00:00Z',
    courtId: 'court',
    rentDuration: 2,
    isOpenPlay: false,
  };
  let service: CourtBookService;
  let repository: jest.Mocked<CourtBookRepository>;
  let courts: jest.Mocked<CourtsRepository>;
  let token: jest.Mocked<OpenPlayTokenHelper>;
  beforeEach(() => {
    repository = {
      reserveCourt: jest.fn(),
    } as unknown as jest.Mocked<CourtBookRepository>;
    repository.reserveCourt.mockResolvedValue({
      kind: 'CREATED',
      bookingId: 'booking',
    });
    courts = {
      findById: jest.fn(),
    } as unknown as jest.Mocked<CourtsRepository>;
    courts.findById.mockResolvedValue({
      id: 'court',
      venueId: 'venue',
    } as Court);
    const pnr = {
      generateUniqueRefId: jest
        .fn<PNRHelper['generateUniqueRefId']>()
        .mockResolvedValue('REF'),
    } as unknown as PNRHelper;
    token = {
      generate: jest
        .fn<OpenPlayTokenHelper['generate']>()
        .mockReturnValue('token'),
    };
    service = new CourtBookService(repository, courts, pnr, token);
  });
  it('takes both owners from the session argument despite a payload email, without a pre-conflict call', async () => {
    const spoof = { ...payload, email: 'other@example.com' };
    const result = await service.createBookingRoute('venue', spoof, owner);
    expect(repository.reserveCourt).toHaveBeenCalledTimes(1);
    const [args] = repository.reserveCourt.mock.calls[0];
    for (const row of [args.schedule, args.booking])
      expect(row).toMatchObject({
        userId: owner.id,
        userEmail: owner.email,
        venueId: 'venue',
        referenceId: 'REF',
      });
    expect(args.schedule.bookedDate).toEqual(new Date(payload.date));
    expect(args.booking.bookDate).toEqual(new Date(payload.date));
    expect(args.schedule.dateTimeVacant).toEqual(
      new Date('2026-11-08T04:00:00Z'),
    );
    expect(args.now).toBeInstanceOf(Date);
    expect(result.bookingId).toBeUndefined();
    expect(result.openPlayJoinToken).toBeUndefined();
    expect(token.generate).not.toHaveBeenCalled();
    expect(args.booking).toMatchObject({
      openPlayCapacity: null,
      openPlayJoinToken: null,
      isOpenPlayPublic: false,
    });
  });
  it.each([
    ['COURT_NOT_BOOKABLE', ErrorConstant.BOOKING_MESSAGES.COURT_NOT_BOOKABLE],
    ['SLOT_TAKEN', ErrorConstant.BOOKING_MESSAGES.COURT_UNAVAILABLE],
    ['BUSY', ErrorConstant.BOOKING_MESSAGES.BUSY],
  ] as const)('maps %s to its conflict message', async (kind, message) => {
    repository.reserveCourt.mockResolvedValue({ kind });
    await expect(
      service.createBookingRoute('venue', payload, owner),
    ).rejects.toThrow(new ConflictException(message));
  });
  it.each([null, { id: 'court', venueId: 'other' } as Court])(
    'returns precise 404 before reserve for %p',
    async (court) => {
      courts.findById.mockResolvedValue(court);
      await expect(
        service.createBookingRoute('venue', payload, owner),
      ).rejects.toThrow(
        new NotFoundException('No court found with id "court" in this venue'),
      );
      expect(repository.reserveCourt).not.toHaveBeenCalled();
    },
  );
  it.each([{ openPlayCapacity: 4 }, { isOpenPlayPublic: true }])(
    'rejects private options first %p',
    async (extra) => {
      await expect(
        service.createBookingRoute('venue', { ...payload, ...extra }, owner),
      ).rejects.toThrow(
        new BadRequestException(
          ErrorConstant.OPEN_PLAY_MESSAGES.INVALID_PRIVATE_OPTIONS,
        ),
      );
      expect(courts.findById).not.toHaveBeenCalled();
      expect(repository.reserveCourt).not.toHaveBeenCalled();
    },
  );
  it.each([{}, { openPlayCapacity: 6, isOpenPlayPublic: true }])(
    'preserves open play options and token %p',
    async (extra) => {
      const result = await service.createBookingRoute(
        'venue',
        { ...payload, isOpenPlay: true, ...extra },
        owner,
      );
      expect(repository.reserveCourt.mock.calls[0][0].booking).toMatchObject({
        openPlayCapacity: extra.openPlayCapacity ?? 4,
        isOpenPlayPublic: extra.isOpenPlayPublic ?? false,
        openPlayJoinToken: 'token',
        userId: owner.id,
      });
      expect(result).toMatchObject({
        bookingId: 'booking',
        openPlayJoinToken: 'token',
      });
    },
  );
  it('allows a false public flag on private bookings', async () => {
    await service.createBookingRoute(
      'venue',
      { ...payload, isOpenPlayPublic: false },
      owner,
    );
    expect(repository.reserveCourt).toHaveBeenCalledTimes(1);
  });
});
