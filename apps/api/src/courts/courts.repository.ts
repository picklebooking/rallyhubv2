import { Injectable } from '@nestjs/common';
import type { Court } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { CreateCourtDto } from './dto/create-court.dto';
import type { UpdateCourtDto } from './dto/update-court.dto';

@Injectable()
export class CourtsRepository {
  /**
   * Constructs the `CourtsRepository`.
   *
   * @param {PrismaService} prisma The Prisma service.
   */
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Finds every court belonging to a venue, newest first.
   *
   * @param   {string}             venueId The venue's id.
   * @returns {Promise<Court[]>}           The venue's courts.
   */
  async findAllByVenue(venueId: string): Promise<Court[]> {
    return this.prisma.db.court.findMany({
      where: { venueId },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Finds a court by its id.
   *
   * @param   {string}                id The court's id.
   * @returns {Promise<Court | null>}    The matching court, or `null`.
   */
  async findById(id: string): Promise<Court | null> {
    return this.prisma.db.court.findUnique({
      where: { id },
    });
  }

  /**
   * Creates a new court for a venue.
   *
   * @param   {string}          venueId  The owning venue's id.
   * @param   {CreateCourtDto}  data     The court payload.
   * @returns {Promise<Court>}           The created court.
   */
  async create(venueId: string, data: CreateCourtDto): Promise<Court> {
    return this.prisma.db.court.create({
      data: {
        venueId,
        name: data.name,
      },
    });
  }

  /**
   * Updates an existing court.
   *
   * @param   {string}         id   The court's id.
   * @param   {UpdateCourtDto} data The fields to update.
   * @returns {Promise<Court>}      The updated court.
   */
  async update(
    id: string,
    venueId: string,
    data: UpdateCourtDto,
  ): Promise<Court> {
    return this.prisma.db.court.update({
      where: { id, venueId },
      data,
    });
  }

  /**
   * Deletes a court.
   *
   * @param   {string}          id The court's id.
   * @returns {Promise<Court>}     The deleted court.
   * @throws  {Prisma.PrismaClientKnownRequestError} With code `P2003` if the
   *          court still has bookings (the FK is `onDelete: Restrict`).
   */
  async delete(id: string, venueId: string): Promise<Court> {
    return this.prisma.db.court.delete({
      where: { id, venueId },
    });
  }
}
