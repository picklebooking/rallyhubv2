import type { UserSession } from '@thallesp/nestjs-better-auth';
import { jest } from '@jest/globals';
import type {
  GetAllVenuesResponse,
  VenueBySlugResponse,
  VenueResponse,
} from '@workspace/shared';
import { VenuesController } from './venues.controller';
import { VenuesService } from './venues.service';

function createMockVenueResponse(
  overrides: Partial<VenueResponse> = {},
): VenueResponse {
  return {
    id: 'venue-1',
    tenantId: 'tenant-1',
    name: 'Cebu Pickleball Club',
    slug: 'cebu-club',
    status: 'ACTIVE',
    address: '123 Osmena Blvd',
    city: 'Cebu City',
    state: 'Cebu',
    zipCode: '6000',
    country: 'PH',
    timezone: 'Asia/Manila',
    phone: '032-555-0100',
    email: 'info@cebuclub.com',
    website: 'https://cebuclub.com',
    logo: null,
    coverImage: null,
    description: 'A great pickleball club',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('VenuesController', () => {
  const session = { user: { id: 'actor-1' } } as UserSession;
  let controller: VenuesController;
  let service: jest.Mocked<VenuesService>;

  beforeEach(() => {
    service = {
      findAll: jest.fn(),
      findById: jest.fn(),
      findBySlug: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    } as unknown as jest.Mocked<VenuesService>;

    controller = new VenuesController(service);
  });

  describe('findAll', () => {
    it('delegates to VenuesService.findAll', async () => {
      const expected: GetAllVenuesResponse = {
        venues: [createMockVenueResponse()],
      };
      service.findAll.mockResolvedValue(expected);

      const result = await controller.findAll();

      expect(result).toEqual(expected);
      expect(service.findAll).toHaveBeenCalled();
    });
  });

  describe('findBySlug', () => {
    it('delegates to VenuesService.findBySlug', async () => {
      const expected: VenueBySlugResponse = {
        id: 'venue-1',
        tenantId: 'tenant-1',
        slug: 'cebu-club',
        name: 'Cebu Pickleball Club',
        status: 'ACTIVE',
      };
      service.findBySlug.mockResolvedValue(expected);

      const result = await controller.findBySlug('cebu-club');

      expect(result).toEqual(expected);
      expect(service.findBySlug).toHaveBeenCalledWith('cebu-club');
    });
  });

  describe('findById', () => {
    it('delegates to VenuesService.findById', async () => {
      const expected = createMockVenueResponse();
      service.findById.mockResolvedValue(expected);

      const result = await controller.findById('venue-1');

      expect(result).toEqual(expected);
      expect(service.findById).toHaveBeenCalledWith('venue-1');
    });
  });

  describe('create', () => {
    it('delegates to VenuesService.create with the resolved tenantId', async () => {
      const dto = { name: 'New Venue', slug: 'new-venue' };
      const expected = createMockVenueResponse({
        id: 'venue-new',
        name: 'New Venue',
        slug: 'new-venue',
      });
      service.create.mockResolvedValue(expected);

      const result = await controller.create(session, 'tenant-1', dto);

      expect(result).toEqual(expected);
      expect(service.create).toHaveBeenCalledWith('actor-1', 'tenant-1', dto);
    });
  });

  describe('update', () => {
    it('delegates to VenuesService.update', async () => {
      const dto = { name: 'Updated Venue' };
      const expected = createMockVenueResponse({ name: 'Updated Venue' });
      service.update.mockResolvedValue(expected);

      const result = await controller.update(session, 'venue-1', dto);

      expect(result).toEqual(expected);
      expect(service.update).toHaveBeenCalledWith('actor-1', 'venue-1', dto);
    });
  });

  describe('delete', () => {
    it('delegates to VenuesService.delete', async () => {
      service.delete.mockResolvedValue(undefined);

      await controller.delete(session, 'venue-1');

      expect(service.delete).toHaveBeenCalledWith('actor-1', 'venue-1');
    });
  });
});
