import type { UserSession } from '@thallesp/nestjs-better-auth';
import { jest } from '@jest/globals';
import type { CourtResponse, GetAllCourtsResponse } from '@workspace/shared';
import { CourtsController } from './courts.controller';
import { CourtsService } from './courts.service';

function createMockCourtResponse(
  overrides: Partial<CourtResponse> = {},
): CourtResponse {
  return {
    id: 'court-1',
    venueId: 'venue-1',
    name: 'Court 1',
    status: 'ACTIVE',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('CourtsController', () => {
  const session = { user: { id: 'actor-1' } } as UserSession;
  let controller: CourtsController;
  let service: jest.Mocked<CourtsService>;

  beforeEach(() => {
    service = {
      findAllByVenue: jest.fn(),
      findById: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    } as unknown as jest.Mocked<CourtsService>;

    controller = new CourtsController(service);
  });

  describe('findAllByTenant', () => {
    it('delegates to CourtsService.findAllByVenue with the resolved venueId', async () => {
      const expected: GetAllCourtsResponse = {
        courts: [createMockCourtResponse()],
      };
      service.findAllByVenue.mockResolvedValue(expected);

      const result = await controller.findAllByTenant('venue-1');

      expect(result).toEqual(expected);
      expect(service.findAllByVenue).toHaveBeenCalledWith('venue-1');
    });
  });

  describe('findById', () => {
    it('delegates to CourtsService.findById', async () => {
      const expected = createMockCourtResponse();
      service.findById.mockResolvedValue(expected);

      const result = await controller.findById('court-1');

      expect(result).toEqual(expected);
      expect(service.findById).toHaveBeenCalledWith('court-1');
    });
  });

  describe('create', () => {
    it('delegates to CourtsService.create with the resolved venueId', async () => {
      const dto = { name: 'New Court' };
      const expected = createMockCourtResponse({
        id: 'court-new',
        name: 'New Court',
      });
      service.create.mockResolvedValue(expected);

      const result = await controller.create(session, 'venue-1', dto);

      expect(result).toEqual(expected);
      expect(service.create).toHaveBeenCalledWith('actor-1', 'venue-1', dto);
    });
  });

  describe('update', () => {
    it('delegates to CourtsService.update', async () => {
      const dto = { name: 'Updated Court' };
      const expected = createMockCourtResponse({ name: 'Updated Court' });
      service.update.mockResolvedValue(expected);

      const result = await controller.update(session, 'court-1', dto);

      expect(result).toEqual(expected);
      expect(service.update).toHaveBeenCalledWith('actor-1', 'court-1', dto);
    });
  });

  describe('delete', () => {
    it('delegates to CourtsService.delete', async () => {
      service.delete.mockResolvedValue(undefined);

      await controller.delete(session, 'court-1');

      expect(service.delete).toHaveBeenCalledWith('actor-1', 'court-1');
    });
  });
});
