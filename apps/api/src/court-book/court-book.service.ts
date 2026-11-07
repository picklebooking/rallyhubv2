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
import { ErrorConstant } from '../constants/error-code.constant';
import { OpenPlayTokenHelper } from '../helper/open-play-token.helper';
import { PNRHelper } from '../helper/pnr.helper';
import { CommonConstants } from '../constants/common.constant';
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
   * @param    {object}                          owner  The signed-in user from the Better Auth session.
   * @returns  {Promise<CreateBookingResponse>}                The created booking.
   * @throws   {BadRequestException} When open play options are sent on a private booking.
   */
  public async createBookingRoute(
    venueId: string,
    payload: CreateCourtBookingDto,
    owner: { id: string; email: string },
  ): Promise<CreateBookingResponse> {
    const {
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

    const court = await this.courtsRepository.findById(courtId);

    if (!court || court.venueId !== venueId) {
      throw new NotFoundException(
        `No court found with id "${courtId}" in this venue`,
      );
    }

    const start = new Date(date);
    const end = new Date(
      start.getTime() + rentDuration * CommonConstants.HOURS_TO_MS,
    );
    const now = new Date();

    const referenceId = await this.pnrHelper.generateUniqueRefId();

    const openPlayJoinToken = isOpenPlay
      ? this.openPlayTokenHelper.generate()
      : null;

    const outcome = await this.courtBookRepository.reserveCourt({
      now,
      schedule: new CreateCourtSchedule(
        start,
        courtId,
        owner.email,
        owner.id,
        end,
        rentDuration,
        venueId,
        false,
        true,
        referenceId,
      ),
      booking: new CreateCourtBooking(
        start,
        owner.email,
        owner.id,
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
    });

    switch (outcome.kind) {
      case 'COURT_NOT_BOOKABLE':
        throw new ConflictException(
          ErrorConstant.BOOKING_MESSAGES.COURT_NOT_BOOKABLE,
        );
      case 'SLOT_TAKEN':
        throw new ConflictException(
          ErrorConstant.BOOKING_MESSAGES.COURT_UNAVAILABLE,
        );
      case 'BUSY':
        throw new ConflictException(ErrorConstant.BOOKING_MESSAGES.BUSY);
    }
    const bookingId = outcome.bookingId;
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
