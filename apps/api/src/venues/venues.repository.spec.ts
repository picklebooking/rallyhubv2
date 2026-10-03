import { jest } from '@jest/globals';
import type { PrismaClient as PrismaClientType } from '../generated/prisma/client';
import type { PrismaService } from '../prisma/prisma.service';
import { VenuesRepository } from './venues.repository';

type MockFn = ReturnType<typeof jest.fn>;

function createMockPrismaService(): PrismaService {
  return {
    db: {
      venue: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
    } as unknown as PrismaClientType,
  } as PrismaService;
}

describe('VenuesRepository', () => {
  let repository: VenuesRepository;
  let prismaService: PrismaService;

  beforeEach(() => {
    prismaService = createMockPrismaService();
    repository = new VenuesRepository(prismaService);
  });

  describe('findAll', () => {
    it('returns all venues ordered by createdAt desc', async () => {
      const mockVenues = [{ id: 'venue-1' }, { id: 'venue-2' }];
      (prismaService.db.venue.findMany as MockFn).mockResolvedValue(
        mockVenues,
      );

      const result = await repository.findAll();

      expect(result).toEqual(mockVenues);
      expect(prismaService.db.venue.findMany).toHaveBeenCalledWith({
        orderBy: { createdAt: 'desc' },
      });
    });
  });

  describe('findAllByTenant', () => {
    it('returns venues for a tenant ordered by createdAt desc', async () => {
      const mockVenues = [{ id: 'venue-1', tenantId: 'tenant-1' }];
      (prismaService.db.venue.findMany as MockFn).mockResolvedValue(
        mockVenues,
      );

      const result = await repository.findAllByTenant('tenant-1');

      expect(result).toEqual(mockVenues);
      expect(prismaService.db.venue.findMany).toHaveBeenCalledWith({
        where: { tenantId: 'tenant-1' },
        orderBy: { createdAt: 'desc' },
      });
    });
  });

  describe('findById', () => {
    it('returns a venue by id', async () => {
      const mockVenue = { id: 'venue-1', slug: 'cebu-club' };
      (prismaService.db.venue.findUnique as MockFn).mockResolvedValue(
        mockVenue,
      );

      const result = await repository.findById('venue-1');

      expect(result).toEqual(mockVenue);
      expect(prismaService.db.venue.findUnique).toHaveBeenCalledWith({
        where: { id: 'venue-1' },
      });
    });

    it('returns null when venue is not found', async () => {
      (prismaService.db.venue.findUnique as MockFn).mockResolvedValue(null);

      const result = await repository.findById('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('findBySlug', () => {
    it('returns a venue by slug', async () => {
      const mockVenue = { id: 'venue-1', slug: 'cebu-club' };
      (prismaService.db.venue.findUnique as MockFn).mockResolvedValue(
        mockVenue,
      );

      const result = await repository.findBySlug('cebu-club');

      expect(result).toEqual(mockVenue);
      expect(prismaService.db.venue.findUnique).toHaveBeenCalledWith({
        where: { slug: 'cebu-club' },
      });
    });
  });

  describe('create', () => {
    it('creates a venue with the given data for a tenant', async () => {
      const dto = {
        name: 'Cebu Pickleball Club',
        slug: 'cebu-club',
        city: 'Cebu City',
        state: 'Cebu',
      };
      const mockCreated = { id: 'venue-1', tenantId: 'tenant-1', ...dto };
      (prismaService.db.venue.create as MockFn).mockResolvedValue(
        mockCreated,
      );

      const result = await repository.create('tenant-1', dto);

      expect(result).toEqual(mockCreated);
      expect(prismaService.db.venue.create).toHaveBeenCalledWith({
        data: {
          tenantId: 'tenant-1',
          name: 'Cebu Pickleball Club',
          slug: 'cebu-club',
          address: undefined,
          city: 'Cebu City',
          state: 'Cebu',
          zipCode: undefined,
          country: undefined,
          timezone: undefined,
          phone: undefined,
          email: undefined,
          website: undefined,
          logo: undefined,
          coverImage: undefined,
          description: undefined,
        },
      });
    });
  });

  describe('update', () => {
    it('updates a venue by id', async () => {
      const dto = { name: 'Updated Club' };
      const mockUpdated = { id: 'venue-1', name: 'Updated Club' };
      (prismaService.db.venue.update as MockFn).mockResolvedValue(
        mockUpdated,
      );

      const result = await repository.update('venue-1', dto);

      expect(result).toEqual(mockUpdated);
      expect(prismaService.db.venue.update).toHaveBeenCalledWith({
        where: { id: 'venue-1' },
        data: dto,
      });
    });
  });

  describe('delete', () => {
    it('deletes a venue by id', async () => {
      const mockDeleted = { id: 'venue-1' };
      (prismaService.db.venue.delete as MockFn).mockResolvedValue(
        mockDeleted,
      );

      const result = await repository.delete('venue-1');

      expect(result).toEqual(mockDeleted);
      expect(prismaService.db.venue.delete).toHaveBeenCalledWith({
        where: { id: 'venue-1' },
      });
    });
  });

  describe('slugExists', () => {
    it('returns true when the slug is taken', async () => {
      (prismaService.db.venue.findUnique as MockFn).mockResolvedValue({
        id: 'venue-1',
      });

      const result = await repository.slugExists('cebu-club');

      expect(result).toBe(true);
    });

    it('returns false when the slug is available', async () => {
      (prismaService.db.venue.findUnique as MockFn).mockResolvedValue(null);

      const result = await repository.slugExists('new-venue');

      expect(result).toBe(false);
    });
  });
});
