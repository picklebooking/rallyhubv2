import {
  BadRequestException,
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
import { ErrorConstant } from '../constants/error-code.constant';
import { OpenPlayTokenHelper } from '../helper/open-play-token.helper';
import { PNRHelper } from '../helper/pnr.helper';
import { DEFAULT_OPEN_PLAY_CAPACITY } from '../open-play/open-play.rules';

@Injectable()
export class CourtBookService {
  /**
   * Constructs a new CourtBookService instance.
   *
   * @param {CourtBookRepository} courtBookRepository The repository for court bookings.
   * @param {CourtsRepository}    courtsRepository    The repository for courts.
   * @param {OpenPlayTokenHelper} openPlayTokenHelper The helper for generating open play join tokens.
   */
  constructor(
    private readonly courtBookRepository: CourtBookRepository,
    private readonly courtsRepository: CourtsRepository,
    private readonly dateTimeHelper: DateTimeHelper,
    private readonly pnrHelper: PNRHelper,
    private readonly openPlayTokenHelper: OpenPlayTokenHelper,
  ) {}

  /**
   * The create booking service route.
   *
   * @param    {string}                          venueId      The current
   *           venue's id, resolved from the request context — never trusted
   *           from the request body.
   * @param    {CreateCourtBookingDto}           payload       The booking payload.
   * @param    {string}                          sessionEmail  The signed-in user's email (from the Better Auth session).
   * @returns  {Promise<CreateBookingResponse>}                The created booking.
   * @throws   {BadRequestException} When open play options are sent on a private booking, or an open play booking names an email other than the session user's.
   */
  public async createBookingRoute(
    venueId: string,
    payload: CreateCourtBookingDto,
    sessionEmail: string,
  ): Promise<CreateBookingResponse> {
    const {
      email,
      date,
      courtId,
      rentDuration,
      isOpenPlay,
      openPlayCapacity,
      isOpenPlayPublic,
    } = payload;

    if (
      !isOpenPlay &&
      (openPlayCapacity !== undefined || isOpenPlayPublic === true)
    ) {
      throw new BadRequestException(
        ErrorConstant.OPEN_PLAY_MESSAGES.INVALID_PRIVATE_OPTIONS,
      );
    }

    // Open Play only: the booker (resolved from `email`) owns the seat, the
    // cancel right, and the management view, and the creator walks away with
    // the join token, so they must be the same account. The general
    // email/session gap for private bookings is a separate, deferred fix.
    if (
      isOpenPlay &&
      email.trim().toLowerCase() !== sessionEmail.trim().toLowerCase()
    ) {
      throw new BadRequestException(
        ErrorConstant.OPEN_PLAY_MESSAGES.EMAIL_MISMATCH,
      );
    }

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
      courtId,
      newDateTime,
      date,
    );

    if (hasConflict) {
      throw new ConflictException(
        ErrorConstant.HTTP_STATUS_MESSAGES[
          ErrorConstant.STATUS_CODES.CONFLICT
        ],
      );
    }

    const userId = await this.courtBookRepository.findUserIdByEmail(email);

    if (!userId) {
      throw new NotFoundException(`No account found for email "${email}"`);
    }

    const referenceId = await this.pnrHelper.generateUniqueRefId();

    const openPlayJoinToken = isOpenPlay
      ? this.openPlayTokenHelper.generate()
      : null;

    const bookingId = await this.courtBookRepository.createCourtBooking(
      new CreateCourtSchedule(
        date,
        courtId,
        email,
        userId,
        newDateTime,
        rentDuration,
        venueId,
        false,
        true,
        referenceId,
      ),
      new CreateCourtBooking(
        date,
        email,
        userId,
        venueId,
        courtId,
        true,
        referenceId,
        isOpenPlay,
        null,
        false,
        isOpenPlay ? (openPlayCapacity ?? DEFAULT_OPEN_PLAY_CAPACITY) : null,
        isOpenPlay ? (isOpenPlayPublic ?? false) : false,
        openPlayJoinToken,
      ),
    );

    const statusCode = ErrorConstant.STATUS_CODES.CREATED;

    return new CreateBookingResponse(
      statusCode,
      ErrorConstant.HTTP_STATUS_MESSAGES[statusCode],
      referenceId,
      undefined,
      undefined,
      isOpenPlay ? bookingId : undefined,
      openPlayJoinToken ?? undefined,
    );
  }
}
