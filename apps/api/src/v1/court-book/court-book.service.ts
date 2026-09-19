import { ConflictException, Injectable } from '@nestjs/common';
import {
  CreateBookingResponse,
  CreateCourtBooking,
  CreateCourtSchedule,
} from '../../models/create-booking.model';
import { CourtBookRepository } from './court-book.repository';
import { CreateCourtBookingDto } from './dto/create-court-booking.dto';
import { DateTimeHelper } from '../../helper/date-time.helper';
import { ErrorCodeConstant } from '../../constants/error-code.constant';
import { PNRHelper } from '../../helper/pnr.helper';

@Injectable()
export class CourtBookService {
  /**
   * Constructs a new CourtBookService instance.
   *
   * @param {CourtBookRepository} courtBookRepository The repository for court bookings.
   */
  constructor(
    private readonly courtBookRepository: CourtBookRepository,
    private readonly dateTimeHelper: DateTimeHelper,
    private readonly pnrHelper: PNRHelper,
  ) {}

  /**
   * The create booking service route..
   *
   * @param    {CourtBooking}                    payload  The booking payload.
   * @returns  {Promise<CreateCourtBookingDto>}           The created booking.
   */
  public async createBookingRoute(
    payload: CreateCourtBookingDto,
  ): Promise<CreateBookingResponse> {
    const { email, tenantId, date, courtId, rentDuration, isOpenPlay } =
      payload;

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

    const referenceId = await this.pnrHelper.generateUniqueRefId();

    await this.courtBookRepository.createCourtBooking(
      new CreateCourtSchedule(
        date,
        courtId,
        email,
        newDateTime,
        rentDuration,
        tenantId,
        false,
        true,
        referenceId,
      ),
      new CreateCourtBooking(
        date,
        email,
        tenantId,
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
