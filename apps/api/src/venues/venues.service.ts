import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type {
  GetAllVenuesResponse,
  VenueBySlugResponse,
  VenueResponse,
} from '@workspace/shared';
import type { Venue } from '../generated/prisma/client';
import { Prisma } from '../generated/prisma/client';
import type { CreateVenueDto } from './dto/create-venue.dto';
import type { UpdateVenueDto } from './dto/update-venue.dto';
import { getSlugValidationError, isValidSlug } from './venue-slug.utils';
import { VenuesRepository } from './venues.repository';

/** Postgres foreign-key-violation code, surfaced by Prisma as `P2003`. */
const FOREIGN_KEY_VIOLATION = 'P2003';

@Injectable()
export class VenuesService {
  /**
   * Constructs the `VenuesService`.
   *
   * @param {VenuesRepository} venuesRepository The repository for venues.
   */
  constructor(private readonly venuesRepository: VenuesRepository) {}

  /**
   * Lists every venue, newest first.
   *
   * @returns {Promise<GetAllVenuesResponse>} All venues.
   */
  async findAll(): Promise<GetAllVenuesResponse> {
    const venues = await this.venuesRepository.findAll();
    return {
      venues: venues.map((venue) => this.toVenueResponse(venue)),
    };
  }

  /**
   * Finds a venue by its id.
   *
   * @param   {string}                 id The venue's id.
   * @returns {Promise<VenueResponse>}    The matching venue.
   * @throws  {NotFoundException}         When no venue has this id.
   */
  async findById(id: string): Promise<VenueResponse> {
    const venue = await this.venuesRepository.findById(id);

    if (!venue) {
      throw new NotFoundException(`Venue with id "${id}" not found`);
    }

    return this.toVenueResponse(venue);
  }

  /**
   * Finds a venue by its subdomain slug.
   *
   * @param   {string}                       slug The venue's slug.
   * @returns {Promise<VenueBySlugResponse>}       The matching venue.
   * @throws  {NotFoundException}                  When no venue has this slug.
   */
  async findBySlug(slug: string): Promise<VenueBySlugResponse> {
    const venue = await this.venuesRepository.findBySlug(slug);

    if (!venue) {
      throw new NotFoundException(`Venue with slug "${slug}" not found`);
    }

    return {
      id: venue.id,
      tenantId: venue.tenantId,
      slug: venue.slug,
      name: venue.name,
      status: venue.status,
    };
  }

  /**
   * Validates the slug and creates a new venue for a tenant.
   *
   * @param   {string}                 tenantId The owning tenant's id.
   * @param   {CreateVenueDto}         dto      The venue payload.
   * @returns {Promise<VenueResponse>}          The created venue.
   * @throws  {BadRequestException}              When the slug fails validation.
   * @throws  {ConflictException}                When the slug is already taken.
   */
  async create(
    tenantId: string,
    dto: CreateVenueDto,
  ): Promise<VenueResponse> {
    if (!isValidSlug(dto.slug)) {
      const error = getSlugValidationError(dto.slug);
      throw new BadRequestException(error ?? 'Invalid slug');
    }

    const slugTaken = await this.venuesRepository.slugExists(dto.slug);
    if (slugTaken) {
      throw new ConflictException(
        `Slug "${dto.slug}" is already taken by another venue`,
      );
    }

    const venue = await this.venuesRepository.create(tenantId, dto);
    return this.toVenueResponse(venue);
  }

  /**
   * Validates the (optional) new slug and updates a venue.
   *
   * @param   {string}                 id  The venue's id.
   * @param   {UpdateVenueDto}         dto The fields to update.
   * @returns {Promise<VenueResponse>}     The updated venue.
   * @throws  {NotFoundException}          When no venue has this id.
   * @throws  {BadRequestException}        When the new slug fails validation.
   * @throws  {ConflictException}          When the new slug is already taken.
   */
  async update(id: string, dto: UpdateVenueDto): Promise<VenueResponse> {
    const existing = await this.venuesRepository.findById(id);

    if (!existing) {
      throw new NotFoundException(`Venue with id "${id}" not found`);
    }

    if (dto.slug !== undefined && dto.slug !== existing.slug) {
      if (!isValidSlug(dto.slug)) {
        const error = getSlugValidationError(dto.slug);
        throw new BadRequestException(error ?? 'Invalid slug');
      }

      const slugTaken = await this.venuesRepository.slugExists(dto.slug);
      if (slugTaken) {
        throw new ConflictException(
          `Slug "${dto.slug}" is already taken by another venue`,
        );
      }
    }

    const venue = await this.venuesRepository.update(id, dto);
    return this.toVenueResponse(venue);
  }

  /**
   * Deletes a venue.
   *
   * A venue whose courts still have bookings cannot be deleted — `Venue.id`
   * cascades into `Court`, but `Court.id` is `onDelete: Restrict` on
   * `CourtBooking.courtId` specifically so booking history is never
   * silently lost. That DB-level rejection surfaces here as a venue-level
   * conflict instead of the underlying court's raw Prisma exception.
   *
   * @param   {string}        id The venue's id.
   * @returns {Promise<void>}
   * @throws  {NotFoundException} When no venue has this id.
   * @throws  {ConflictException} When the venue's courts still have bookings.
   */
  async delete(id: string): Promise<void> {
    const existing = await this.venuesRepository.findById(id);

    if (!existing) {
      throw new NotFoundException(`Venue with id "${id}" not found`);
    }

    try {
      await this.venuesRepository.delete(id);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === FOREIGN_KEY_VIOLATION
      ) {
        throw new ConflictException(
          'Cannot delete venue with active bookings. Cancel or reassign its bookings first.',
        );
      }

      throw error;
    }
  }

  /**
   * Maps a Prisma `Venue` record to its public API shape.
   *
   * @param   {Venue}         venue The raw venue record.
   * @returns {VenueResponse}       The public-facing venue shape.
   */
  private toVenueResponse(venue: Venue): VenueResponse {
    return {
      id: venue.id,
      tenantId: venue.tenantId,
      name: venue.name,
      slug: venue.slug,
      status: venue.status,
      address: venue.address,
      city: venue.city,
      state: venue.state,
      zipCode: venue.zipCode,
      country: venue.country,
      timezone: venue.timezone,
      phone: venue.phone,
      email: venue.email,
      website: venue.website,
      logo: venue.logo,
      coverImage: venue.coverImage,
      description: venue.description,
      createdAt: venue.createdAt.toISOString(),
      updatedAt: venue.updatedAt.toISOString(),
    };
  }
}
