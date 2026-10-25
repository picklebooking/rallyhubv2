import { jest } from '@jest/globals';
import type { UserSession } from '@thallesp/nestjs-better-auth';
import { CourtBookController } from './court-book.controller';
import { CourtBookService } from './court-book.service';
import { CreateBookingResponse } from '../models/create-booking.model';

const session = {
  user: { id: 'u-1', email: 'player@example.com' },
} as unknown as UserSession;

describe('CourtBookController', () => {
  let controller: CourtBookController;
  let service: jest.Mocked<CourtBookService>;

  beforeEach(() => {
    service = {
      createBookingRoute: jest.fn(),
    } as unknown as jest.Mocked<CourtBookService>;

    controller = new CourtBookController(service);
  });

  describe('createBooking', () => {
    it('forwards the resolved venueId and request body to the service', async () => {
      const dto = {
        date: '2026-06-01T10:00:00.000Z',
        email: 'player@example.com',
        courtId: 'court-1',
        rentDuration: 2,
        isOpenPlay: false,
      };
      const expected = new CreateBookingResponse(201, 'Created', 'PNR123');
      service.createBookingRoute.mockResolvedValue(expected);

      const result = await controller.createBooking('venue-1', dto, session);

      expect(result).toEqual(expected);
      expect(service.createBookingRoute).toHaveBeenCalledWith(
        'venue-1',
        dto,
        'player@example.com',
      );
    });
  });
});
