import { Injectable } from '@nestjs/common';
import type { Venue } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { CreateVenueDto } from './dto/create-venue.dto';
import type { UpdateVenueDto } from './dto/update-venue.dto';

@Injectable()
export class VenuesRepository {
  /**
   * Constructs the `VenuesRepository`.
   *
   * @param {PrismaService} prisma The Prisma service.
   */
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Finds every venue, newest first.
   *
   * @returns {Promise<Venue[]>} All venues.
   */
  async findAll(): Promise<Venue[]> {
    return this.prisma.db.venue.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Finds every venue belonging to a tenant, newest first.
   *
   * @param   {string}            tenantId The tenant's id.
   * @returns {Promise<Venue[]>}            The tenant's venues.
   */
  async findAllByTenant(tenantId: string): Promise<Venue[]> {
    return this.prisma.db.venue.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Finds a venue by its id.
   *
   * @param   {string}                id The venue's id.
   * @returns {Promise<Venue | null>}    The matching venue, or `null`.
   */
  async findById(id: string): Promise<Venue | null> {
    return this.prisma.db.venue.findUnique({
      where: { id },
    });
  }

  /**
   * Finds a venue by its subdomain slug.
   *
   * @param   {string}                slug The venue's slug.
   * @returns {Promise<Venue | null>}       The matching venue, or `null`.
   */
  async findBySlug(slug: string): Promise<Venue | null> {
    return this.prisma.db.venue.findUnique({
      where: { slug },
    });
  }

  /**
   * Creates a new venue for a tenant.
   *
   * @param   {string}          tenantId The owning tenant's id.
   * @param   {CreateVenueDto}  data     The venue payload.
   * @returns {Promise<Venue>}           The created venue.
   */
  async create(tenantId: string, data: CreateVenueDto): Promise<Venue> {
    return this.prisma.db.venue.create({
      data: {
        tenantId,
        name: data.name,
        slug: data.slug,
        address: data.address,
        city: data.city,
        state: data.state,
        zipCode: data.zipCode,
        country: data.country,
        timezone: data.timezone,
        phone: data.phone,
        email: data.email,
        website: data.website,
        logo: data.logo,
        coverImage: data.coverImage,
        description: data.description,
      },
    });
  }

  /**
   * Updates an existing venue.
   *
   * @param   {string}         id   The venue's id.
   * @param   {UpdateVenueDto} data The fields to update.
   * @returns {Promise<Venue>}      The updated venue.
   */
  async update(id: string, data: UpdateVenueDto): Promise<Venue> {
    return this.prisma.db.venue.update({
      where: { id },
      data,
    });
  }

  /**
   * Deletes a venue.
   *
   * @param   {string}         id The venue's id.
   * @returns {Promise<Venue>}    The deleted venue.
   * @throws  {Prisma.PrismaClientKnownRequestError} With code `P2003` if the
   *          venue's courts still have bookings (`Court.tenantId`/`venueId`
   *          cascade, but `CourtBooking.courtId` is `onDelete: Restrict`).
   */
  async delete(id: string): Promise<Venue> {
    return this.prisma.db.venue.delete({
      where: { id },
    });
  }

  /**
   * Checks whether a slug is already in use by another venue.
   *
   * @param   {string}           slug The slug to check.
   * @returns {Promise<boolean>}      `true` if a venue already has this slug.
   */
  async slugExists(slug: string): Promise<boolean> {
    const venue = await this.prisma.db.venue.findUnique({
      where: { slug },
      select: { id: true },
    });
    return venue !== null;
  }
}
