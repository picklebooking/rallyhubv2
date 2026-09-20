import { Injectable } from '@nestjs/common';
import { CommonConstants } from '../constants/common.constant';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PNRHelper {
  /**
   * Constructs the `PNRHelper` class.
   *
   * @param prismaService
   */
  constructor(private readonly prismaService: PrismaService) {}

  /**
   * Generates a reference ID based on the given characters.
   *
   * @returns {string}  The generated reference ID.
   */
  private generateReferenceId(): string {
    const values = new Uint32Array(CommonConstants.BOOKING_REF_ID_LENGTH);
    crypto.getRandomValues(values);

    const { CHARS, SEPARATOR } = CommonConstants;

    const generateReferenceId = Array.from(
      values,
      (value) => CHARS[value % CHARS.length],
    ).join(SEPARATOR.EMPTY_STRING);

    return `RH-${generateReferenceId}`;
  }

  /**
   * Generates a unique reference id for the booking.
   * Checks the database first for uniqueness; if found not unique, it will generate new reference id.
   *
   * @returns  {Promise<string>}    The unique reference id.
   */
  public async generateUniqueRefId(): Promise<string> {
    let referenceId: string = CommonConstants.SEPARATOR.EMPTY_STRING;
    let exists = true;

    while (exists) {
      referenceId = this.generateReferenceId();

      const getExistingBookingRef =
        await this.prismaService.db.courtBooking.findUnique({
          where: { referenceId: referenceId },
        });

      exists = !!getExistingBookingRef;
    }

    return referenceId;
  }
}
