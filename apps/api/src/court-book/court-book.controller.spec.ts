import { jest } from '@jest/globals';
import { CourtBookController } from './court-book.controller';
import { CourtBookService } from './court-book.service';
import { CreateBookingResponse } from '../models/create-booking.model';

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
    it('forwards the resolved tenantId, venueId, and request body to the service', async () => {
      const dto = {
        date: '2026-06-01T10:00:00.000Z',
        email: 'player@example.com',
        courtId: 'court-1',
        rentDuration: 2,
        isOpenPlay: false,
      };
      const expected = new CreateBookingResponse(201, 'Created', 'PNR123');
      service.createBookingRoute.mockResolvedValue(expected);

      const result = await controller.createBooking(
        'tenant-1',
        'venue-1',
        dto,
      );

      expect(result).toEqual(expected);
      expect(service.createBookingRoute).toHaveBeenCalledWith(
        'tenant-1',
        'venue-1',
        dto,
      );
    });
  });
});
