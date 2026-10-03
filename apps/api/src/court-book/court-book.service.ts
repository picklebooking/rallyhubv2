import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  CreateBookingResponse,
  CreateCourtBooking,
  CreateCourtSchedule,
} from '../models/create-booking.model';
import { CourtsRepository } from '../courts/courts.repository';
import { CourtBookRepository } from './court-book.repository';
import { CreateCourtBookingDto } from './dto/create-court-booking.dto';
import { DateTimeHelper } from '../helper/date-time.helper';
import { ErrorCodeConstant } from '../constants/error-code.constant';
import { PNRHelper } from '../helper/pnr.helper';

@Injectable()
export class CourtBookService {
  /**
   * Constructs a new CourtBookService instance.
   *
   * @param {CourtBookRepository} courtBookRepository The repository for court bookings.
   * @param {CourtsRepository}    courtsRepository    The repository for courts.
   */
  constructor(
    private readonly courtBookRepository: CourtBookRepository,
    private readonly courtsRepository: CourtsRepository,
    private readonly dateTimeHelper: DateTimeHelper,
    private readonly pnrHelper: PNRHelper,
  ) {}

  /**
   * The create booking service route.
   *
   * @param    {string}                          tenantId The current tenant's
   *           id, resolved from the request context — never trusted from
   *           the request body.
   * @param    {string}                          venueId  The current venue's
   *           id, resolved from the request context.
   * @param    {CreateCourtBookingDto}           payload  The booking payload.
   * @returns  {Promise<CreateBookingResponse>}           The created booking.
   */
  public async createBookingRoute(
    tenantId: string,
    venueId: string,
    payload: CreateCourtBookingDto,
  ): Promise<CreateBookingResponse> {
    const { email, date, courtId, rentDuration, isOpenPlay } = payload;

    const court = await this.courtsRepository.findById(courtId);

    if (!court || court.venueId !== venueId) {
      throw new NotFoundException(
        `No court found with id "${courtId}" in this venue`,
      );
    }

    const newDateTime = this.dateTimeHelper.addHoursToCurrentDateTime(
      rentDuration,
      date,
    );

    const hasConflict = await this.courtBookRepository.hasConflictBooking(
      tenantId,
      courtId,
      newDateTime,
      date,
    );

    if (hasConflict) {
      throw new ConflictException(
        ErrorCodeConstant.HTTP_STATUS_MESSAGES[
          ErrorCodeConstant.STATUS_CODES.CONFLICT
        ],
      );
    }

    const userId = await this.courtBookRepository.findUserIdByEmail(email);

    if (!userId) {
      throw new NotFoundException(`No account found for email "${email}"`);
    }

    const referenceId = await this.pnrHelper.generateUniqueRefId();

    await this.courtBookRepository.createCourtBooking(
      new CreateCourtSchedule(
        date,
        courtId,
        email,
        userId,
        newDateTime,
        rentDuration,
        tenantId,
        venueId,
        false,
        true,
        referenceId,
      ),
      new CreateCourtBooking(
        date,
        email,
        userId,
        tenantId,
        venueId,
        courtId,
        true,
        referenceId,
        isOpenPlay,
      ),
    );

    const statusCode = ErrorCodeConstant.STATUS_CODES.CREATED;

    return new CreateBookingResponse(
      statusCode,
      ErrorCodeConstant.HTTP_STATUS_MESSAGES[statusCode],
      referenceId,
    );
  }
}
