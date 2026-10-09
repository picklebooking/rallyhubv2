import { Injectable } from '@nestjs/common';
import {
  CreateCourtBooking,
  CreateCourtSchedule,
} from '../models/create-booking.model';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CourtBookRepository {
  /**
   * Construct the `CourtBookRepository`.
   *
   * @param {PrismaService}  prismaService  The Prisma service.
   */
  constructor(private readonly prismaService: PrismaService) {}

  /**
   * Finds a user's id by their email.
   *
   * @param    {string}               email The user's email.
   * @returns  {Promise<string | null>}      The user's id, or `null` if no
   *           user has this email.
   */
  public async findUserIdByEmail(email: string): Promise<string | null> {
    const user = await this.prismaService.db.user.findUnique({
      where: { email },
      select: { id: true },
    });

    return user?.id ?? null;
  }

  /**
   * Checks if a booking has conflict schedule.
   *
   * Only occupied schedules (`isVacant: false`) block the slot, so cancelled
   * bookings (which set `isVacant: true`) free it. Filters on the
   * non-nullable `isVacant`, not the nullable `isActive`.
   *
   * @param    {string}    courtId     The court id.
   * @param    {Date}      newDateTime The new date with the added duration.
   * @param    {string}    date        The scheduled date.
   * @returns  {boolean}               Returns `true` if has conflict, otherwise `false`.
   */
  public async hasConflictBooking(
    courtId: string,
    newDateTime: Date,
    date: string,
  ): Promise<boolean> {
    const hasConflict = await this.prismaService.db.courtSchedule.findFirst({
      where: {
        courtId: courtId,
        bookedDate: {
          lt: newDateTime,
        },
        dateTimeVacant: {
          gt: date,
        },
        isVacant: false,
      },
    });

    return !!hasConflict;
  }

  /**
   * Creates the court booking and post in the database.
   *
   * For Open Play bookings, the booker's first roster seat is created in
   * the same transaction.
   *
   * @param    {CreateCourtSchedule} courtSchedule  The court schedule object.
   * @param    {CreateCourtBooking}  courtBooking   The court booking object.
   * @returns  {Promise<string>}                    The new booking's id.
   */
  public async createCourtBooking(
    courtSchedule: CreateCourtSchedule,
    courtBooking: CreateCourtBooking,
  ): Promise<string> {
    const [, booking] = await this.prismaService.db.$transaction([
      this.prismaService.db.courtSchedule.create({
        data: courtSchedule,
      }),
      this.prismaService.db.courtBooking.create({
        data: courtBooking.isOpenPlay
          ? {
              ...courtBooking,
              openPlaySeats: {
                create: { userId: courtBooking.userId, isBooker: true },
              },
            }
          : { ...courtBooking },
        select: { id: true },
      }),
    ]);
    return booking.id;
  }
}
