import { jest } from '@jest/globals';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client';
import type { Court } from '../generated/prisma/client';
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
  let repository: jest.Mocked<CourtsRepository>;

  beforeEach(() => {
    repository = {
      findAllByVenue: jest.fn(),
      findById: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    } as unknown as jest.Mocked<CourtsRepository>;

    service = new CourtsService(repository);
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

      const result = await service.create('venue-1', dto);

      expect(result.id).toBe('court-1');
      expect(repository.create).toHaveBeenCalledWith('venue-1', dto);
    });
  });

  describe('delete', () => {
    it('deletes an existing court', async () => {
      const existing = createMockCourt();
      repository.findById.mockResolvedValue(existing);
      repository.delete.mockResolvedValue(existing);

      await service.delete('court-1');

      expect(repository.delete).toHaveBeenCalledWith('court-1');
    });

    it('throws NotFoundException for an unknown court', async () => {
      repository.findById.mockResolvedValue(null);

      await expect(service.delete('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws ConflictException when the court still has bookings', async () => {
      const existing = createMockCourt();
      repository.findById.mockResolvedValue(existing);
      repository.delete.mockRejectedValue(createForeignKeyViolationError());

      await expect(service.delete('court-1')).rejects.toThrow(
        ConflictException,
      );
    });
  });
});
