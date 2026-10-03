import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { CourtResponse, GetAllCourtsResponse } from '@workspace/shared';
import type { Court } from '../generated/prisma/client';
import { Prisma } from '../generated/prisma/client';
import type { CreateCourtDto } from './dto/create-court.dto';
import type { UpdateCourtDto } from './dto/update-court.dto';
import { CourtsRepository } from './courts.repository';

/** Postgres foreign-key-violation code, surfaced by Prisma as `P2003`. */
const FOREIGN_KEY_VIOLATION = 'P2003';

@Injectable()
export class CourtsService {
  /**
   * Constructs the `CourtsService`.
   *
   * @param {CourtsRepository} courtsRepository The repository for courts.
   */
  constructor(private readonly courtsRepository: CourtsRepository) {}

  /**
   * Lists every court belonging to a venue, newest first.
   *
   * @param   {string}                        venueId The venue's id.
   * @returns {Promise<GetAllCourtsResponse>}          The venue's courts.
   */
  async findAllByVenue(venueId: string): Promise<GetAllCourtsResponse> {
    const courts = await this.courtsRepository.findAllByVenue(venueId);
    return {
      courts: courts.map((court) => this.toCourtResponse(court)),
    };
  }

  /**
   * Finds a court by its id.
   *
   * @param   {string}                 id The court's id.
   * @returns {Promise<CourtResponse>}    The matching court.
   * @throws  {NotFoundException}         When no court has this id.
   */
  async findById(id: string): Promise<CourtResponse> {
    const court = await this.courtsRepository.findById(id);

    if (!court) {
      throw new NotFoundException(`Court with id "${id}" not found`);
    }

    return this.toCourtResponse(court);
  }

  /**
   * Creates a new court for a venue.
   *
   * @param   {string}                venueId The venue's id.
   * @param   {CreateCourtDto}        dto     The court payload.
   * @returns {Promise<CourtResponse>}        The created court.
   */
  async create(venueId: string, dto: CreateCourtDto): Promise<CourtResponse> {
    const court = await this.courtsRepository.create(venueId, dto);
    return this.toCourtResponse(court);
  }

  /**
   * Updates an existing court.
   *
   * @param   {string}                id  The court's id.
   * @param   {UpdateCourtDto}        dto The fields to update.
   * @returns {Promise<CourtResponse>}     The updated court.
   * @throws  {NotFoundException}          When no court has this id.
   */
  async update(id: string, dto: UpdateCourtDto): Promise<CourtResponse> {
    const existing = await this.courtsRepository.findById(id);

    if (!existing) {
      throw new NotFoundException(`Court with id "${id}" not found`);
    }

    const court = await this.courtsRepository.update(id, dto);
    return this.toCourtResponse(court);
  }

  /**
   * Deletes a court.
   *
   * A court with existing bookings cannot be deleted — `Court.id` is
   * `onDelete: Restrict` on `CourtBooking.courtId` specifically so booking
   * history is never silently lost. That DB-level rejection is caught here
   * and turned into a clear, actionable error instead of a raw Prisma
   * exception.
   *
   * @param   {string}        id The court's id.
   * @returns {Promise<void>}
   * @throws  {NotFoundException} When no court has this id.
   * @throws  {ConflictException} When the court still has bookings.
   */
  async delete(id: string): Promise<void> {
    const existing = await this.courtsRepository.findById(id);

    if (!existing) {
      throw new NotFoundException(`Court with id "${id}" not found`);
    }

    try {
      await this.courtsRepository.delete(id);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === FOREIGN_KEY_VIOLATION
      ) {
        throw new ConflictException(
          'This court still has bookings and cannot be deleted. Cancel or reassign its bookings first.',
        );
      }

      throw error;
    }
  }

  /**
   * Maps a Prisma `Court` record to its public API shape.
   *
   * @param   {Court}         court The raw court record.
   * @returns {CourtResponse}       The public-facing court shape.
   */
  private toCourtResponse(court: Court): CourtResponse {
    return {
      id: court.id,
      venueId: court.venueId,
      name: court.name,
      status: court.status,
      createdAt: court.createdAt.toISOString(),
      updatedAt: court.updatedAt.toISOString(),
    };
  }
}
