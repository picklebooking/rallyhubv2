import { jest } from '@jest/globals';
import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../generated/prisma/client';
import type { Court } from '../generated/prisma/client';
import { AuthorizationService } from '../authorization/authorization.service';
import { VenuesRepository } from '../venues/venues.repository';
import type { Venue } from '../generated/prisma/client';
import { CourtsRepository } from './courts.repository';
import { CourtsService } from './courts.service';

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

/** Builds a Prisma foreign-key-violation error the same way the real client throws it. */
function createForeignKeyViolationError(): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError('Foreign key violation', {
    code: 'P2003',
    clientVersion: 'test',
  });
}

describe('CourtsService', () => {
  let service: CourtsService;
  let venues: jest.Mocked<VenuesRepository>;
  let authorization: jest.Mocked<AuthorizationService>;
  let repository: jest.Mocked<CourtsRepository>;

  beforeEach(() => {
    repository = {
      findAllByVenue: jest.fn(),
      findById: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    } as unknown as jest.Mocked<CourtsRepository>;

    venues = {
      findById: jest.fn(),
    } as unknown as jest.Mocked<VenuesRepository>;
    venues.findById.mockResolvedValue({
      id: 'venue-1',
      tenantId: 'tenant-1',
    } as Venue);
    authorization = {
      assertCanManageVenue: jest.fn(),
    } as unknown as jest.Mocked<AuthorizationService>;
    authorization.assertCanManageVenue.mockResolvedValue(undefined);
    service = new CourtsService(repository, venues, authorization);
  });

  describe('findAllByVenue', () => {
    it('returns all courts for a venue', async () => {
      const courts = [
        createMockCourt({ id: 'court-1' }),
        createMockCourt({ id: 'court-2' }),
      ];
      repository.findAllByVenue.mockResolvedValue(courts);

      const result = await service.findAllByVenue('venue-1');

      expect(result.courts).toHaveLength(2);
      expect(repository.findAllByVenue).toHaveBeenCalledWith('venue-1');
    });
  });

  describe('findById', () => {
    it('returns a court by id, including venueId', async () => {
      const court = createMockCourt();
      repository.findById.mockResolvedValue(court);

      const result = await service.findById('court-1');

      expect(result.id).toBe('court-1');
      expect(result.venueId).toBe('venue-1');
    });

    it('throws NotFoundException for an unknown id', async () => {
      repository.findById.mockResolvedValue(null);

      await expect(service.findById('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('create', () => {
    it('creates a court under the given venue', async () => {
      const dto = { name: 'Court 1' };
      const createdCourt = createMockCourt();
      repository.create.mockResolvedValue(createdCourt);

      const result = await service.create('actor-1', 'venue-1', dto);

      expect(result.id).toBe('court-1');
      expect(repository.create).toHaveBeenCalledWith('venue-1', dto);
    });
  });

  describe('mutation resource scope', () => {
    it('updates using the persisted venue scope', async () => {
      repository.findById.mockResolvedValue(createMockCourt());
      repository.update.mockResolvedValue(createMockCourt({ name: 'Updated' }));
      await service.update('actor-1', 'court-1', { name: 'Updated' });
      expect(authorization.assertCanManageVenue).toHaveBeenCalledWith(
        'actor-1',
        'tenant-1',
        'venue-1',
      );
      expect(repository.update).toHaveBeenCalledWith('court-1', 'venue-1', {
        name: 'Updated',
      });
    });

    it.each(['create', 'update', 'delete'] as const)(
      'returns missing venue before %s permission checks',
      async (operation) => {
        repository.findById.mockResolvedValue(createMockCourt());
        venues.findById.mockResolvedValue(null);
        const result =
          operation === 'create'
            ? service.create('actor-1', 'venue-1', { name: 'Court' })
            : operation === 'update'
              ? service.update('actor-1', 'court-1', { name: 'Court' })
              : service.delete('actor-1', 'court-1');
        await expect(result).rejects.toThrow(NotFoundException);
        expect(authorization.assertCanManageVenue).not.toHaveBeenCalled();
        expect(repository.create).not.toHaveBeenCalled();
        expect(repository.update).not.toHaveBeenCalled();
        expect(repository.delete).not.toHaveBeenCalled();
      },
    );

    it.each(['create', 'update', 'delete'] as const)(
      'does not persist denied %s',
      async (operation) => {
        repository.findById.mockResolvedValue(createMockCourt());
        authorization.assertCanManageVenue.mockRejectedValue(
          new ForbiddenException(),
        );
        const result =
          operation === 'create'
            ? service.create('actor-1', 'venue-1', { name: 'Court' })
            : operation === 'update'
              ? service.update('actor-1', 'court-1', { name: 'Court' })
              : service.delete('actor-1', 'court-1');
        await expect(result).rejects.toThrow(ForbiddenException);
        expect(repository.create).not.toHaveBeenCalled();
        expect(repository.update).not.toHaveBeenCalled();
        expect(repository.delete).not.toHaveBeenCalled();
      },
    );

    it('returns missing court before update permission checks', async () => {
      repository.findById.mockResolvedValue(null);
      await expect(
        service.update('actor-1', 'missing', { name: 'Court' }),
      ).rejects.toThrow(NotFoundException);
      expect(venues.findById).not.toHaveBeenCalled();
      expect(authorization.assertCanManageVenue).not.toHaveBeenCalled();
    });
  });

  describe('delete', () => {
    it('deletes an existing court', async () => {
      const existing = createMockCourt();
      repository.findById.mockResolvedValue(existing);
      repository.delete.mockResolvedValue(existing);

      await service.delete('actor-1', 'court-1');

      expect(repository.delete).toHaveBeenCalledWith('court-1', 'venue-1');
    });

    it('throws NotFoundException for an unknown court', async () => {
      repository.findById.mockResolvedValue(null);

      await expect(service.delete('actor-1', 'nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws ConflictException when the court still has bookings', async () => {
      const existing = createMockCourt();
      repository.findById.mockResolvedValue(existing);
      repository.delete.mockRejectedValue(createForeignKeyViolationError());

      await expect(service.delete('actor-1', 'court-1')).rejects.toThrow(
        ConflictException,
      );
    });
  });
});
