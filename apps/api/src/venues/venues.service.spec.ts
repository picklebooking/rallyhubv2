import { jest } from '@jest/globals';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../generated/prisma/client';
import type { Venue } from '../generated/prisma/client';
import { VenuesRepository } from './venues.repository';
import { VenuesService } from './venues.service';

function createMockVenue(overrides: Partial<Venue> = {}): Venue {
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

describe('VenuesService', () => {
  let service: VenuesService;
  let repository: jest.Mocked<VenuesRepository>;

  beforeEach(() => {
    repository = {
      findAll: jest.fn(),
      findAllByTenant: jest.fn(),
      findById: jest.fn(),
      findBySlug: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      slugExists: jest.fn(),
    } as unknown as jest.Mocked<VenuesRepository>;

    service = new VenuesService(repository);
  });

  describe('findAll', () => {
    it('returns all venues', async () => {
      const venues = [
        createMockVenue({ id: 'venue-1', slug: 'cebu-club' }),
        createMockVenue({ id: 'venue-2', slug: 'downtown-courts' }),
      ];
      repository.findAll.mockResolvedValue(venues);

      const result = await service.findAll();

      expect(result.venues).toHaveLength(2);
      expect(result.venues[0]?.id).toBe('venue-1');
      expect(result.venues[1]?.id).toBe('venue-2');
    });

    it('returns an empty array when no venues exist', async () => {
      repository.findAll.mockResolvedValue([]);

      const result = await service.findAll();

      expect(result.venues).toHaveLength(0);
    });

    it('serializes dates as ISO strings', async () => {
      const venue = createMockVenue({
        createdAt: new Date('2026-06-15T10:30:00Z'),
      });
      repository.findAll.mockResolvedValue([venue]);

      const result = await service.findAll();

      expect(result.venues[0]?.createdAt).toBe('2026-06-15T10:30:00.000Z');
    });
  });

  describe('findById', () => {
    it('returns a venue by id', async () => {
      const venue = createMockVenue();
      repository.findById.mockResolvedValue(venue);

      const result = await service.findById('venue-1');

      expect(result.id).toBe('venue-1');
      expect(result.name).toBe('Cebu Pickleball Club');
      expect(result.slug).toBe('cebu-club');
      expect(result.tenantId).toBe('tenant-1');
    });

    it('throws NotFoundException for an unknown id', async () => {
      repository.findById.mockResolvedValue(null);

      await expect(service.findById('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('findBySlug', () => {
    it('returns a venue by slug', async () => {
      const venue = createMockVenue();
      repository.findBySlug.mockResolvedValue(venue);

      const result = await service.findBySlug('cebu-club');

      expect(result.id).toBe('venue-1');
      expect(result.slug).toBe('cebu-club');
    });

    it('throws NotFoundException for an unknown slug', async () => {
      repository.findBySlug.mockResolvedValue(null);

      await expect(service.findBySlug('unknown')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('create', () => {
    it('creates a venue with a valid slug', async () => {
      const dto = {
        name: 'Cebu Pickleball Club',
        slug: 'cebu-club',
      };
      const createdVenue = createMockVenue();

      repository.slugExists.mockResolvedValue(false);
      repository.create.mockResolvedValue(createdVenue);

      const result = await service.create('tenant-1', dto);

      expect(result.id).toBe('venue-1');
      expect(result.name).toBe('Cebu Pickleball Club');
      expect(repository.create).toHaveBeenCalledWith('tenant-1', dto);
    });

    it('throws BadRequestException for an invalid slug', async () => {
      const dto = {
        name: 'Bad Venue',
        slug: 'AB', // too short + uppercase
      };

      await expect(service.create('tenant-1', dto)).rejects.toThrow(
        BadRequestException,
      );
      expect(repository.create).not.toHaveBeenCalled();
    });

    it('throws BadRequestException for a reserved slug', async () => {
      const dto = {
        name: 'Admin Venue',
        slug: 'admin',
      };

      await expect(service.create('tenant-1', dto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('throws ConflictException when the slug already exists', async () => {
      const dto = {
        name: 'Duplicate Club',
        slug: 'cebu-club',
      };

      repository.slugExists.mockResolvedValue(true);

      await expect(service.create('tenant-1', dto)).rejects.toThrow(
        ConflictException,
      );
      expect(repository.create).not.toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it('updates a venue', async () => {
      const existing = createMockVenue();
      const updated = createMockVenue({ name: 'Updated Club' });

      repository.findById.mockResolvedValue(existing);
      repository.update.mockResolvedValue(updated);

      const result = await service.update('venue-1', { name: 'Updated Club' });

      expect(result.name).toBe('Updated Club');
      expect(repository.update).toHaveBeenCalledWith('venue-1', {
        name: 'Updated Club',
      });
    });

    it('throws NotFoundException when the venue does not exist', async () => {
      repository.findById.mockResolvedValue(null);

      await expect(
        service.update('nonexistent', { name: 'Updated Club' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('validates the new slug if it is being changed', async () => {
      const existing = createMockVenue();
      repository.findById.mockResolvedValue(existing);

      await expect(service.update('venue-1', { slug: 'AB' })).rejects.toThrow(
        BadRequestException,
      );
    });

    it('throws ConflictException when updating to an already taken slug', async () => {
      const existing = createMockVenue();
      repository.findById.mockResolvedValue(existing);
      repository.slugExists.mockResolvedValue(true);

      await expect(
        service.update('venue-1', { slug: 'taken-slug' }),
      ).rejects.toThrow(ConflictException);
    });

    it('skips slug validation when the slug is unchanged', async () => {
      const existing = createMockVenue({ slug: 'cebu-club' });
      const updated = createMockVenue({ name: 'Renamed' });

      repository.findById.mockResolvedValue(existing);
      repository.update.mockResolvedValue(updated);

      await service.update('venue-1', { slug: 'cebu-club', name: 'Renamed' });

      expect(repository.slugExists).not.toHaveBeenCalled();
    });
  });

  describe('delete', () => {
    it('deletes an existing venue', async () => {
      const existing = createMockVenue();
      repository.findById.mockResolvedValue(existing);
      repository.delete.mockResolvedValue(existing);

      await service.delete('venue-1');

      expect(repository.delete).toHaveBeenCalledWith('venue-1');
    });

    it('throws NotFoundException for an unknown venue', async () => {
      repository.findById.mockResolvedValue(null);

      await expect(service.delete('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws ConflictException with a venue-specific message when the venue still has bookings', async () => {
      const existing = createMockVenue();
      repository.findById.mockResolvedValue(existing);
      repository.delete.mockRejectedValue(createForeignKeyViolationError());

      await expect(service.delete('venue-1')).rejects.toThrow(
        ConflictException,
      );
      await expect(service.delete('venue-1')).rejects.toThrow(
        /cannot delete/i,
      );
    });

    it('rethrows unrelated errors from delete', async () => {
      const existing = createMockVenue();
      repository.findById.mockResolvedValue(existing);
      const unrelatedError = new Error('connection lost');
      repository.delete.mockRejectedValue(unrelatedError);

      await expect(service.delete('venue-1')).rejects.toThrow(
        'connection lost',
      );
    });
  });
});
