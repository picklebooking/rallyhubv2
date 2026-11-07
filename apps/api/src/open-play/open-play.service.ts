import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type {
  JoinOpenPlayResponse,
  ListOpenPlayResponse,
  OpenPlayByTokenResponse,
  OpenPlayListing,
  OpenPlayManageResponse,
} from '@workspace/shared';
import { AuthorizationRepository } from '../authorization/authorization.repository';
import { ErrorConstant } from '../constants/error-code.constant';
import { OpenPlayTokenHelper } from '../helper/open-play-token.helper';
import type {
  EnableOpenPlayDto,
  ListOpenPlayQueryDto,
  SetOpenPlayVisibilityDto,
} from './dto';
import {
  OpenPlayRepository,
  type OpenPlayBookingRecord,
  type OpenPlayListingRecord,
} from './open-play.repository';
import {
  DEFAULT_OPEN_PLAY_CAPACITY,
  DEFAULT_OPEN_PLAY_PAGE_SIZE,
  hasStarted,
  isFull,
  isInsideCutoff,
} from './open-play.rules';

const MSG = ErrorConstant.OPEN_PLAY_MESSAGES;

/** A booking whose Open Play invariant holds (flag, capacity, token all set). */
type OpenPlayRecord = OpenPlayBookingRecord & {
  isOpenPlay: true;
  openPlayCapacity: number;
  openPlayJoinToken: string;
};

@Injectable()
export class OpenPlayService {
  /**
   * Constructs the `OpenPlayService`.
   *
   * @param {OpenPlayRepository}  repository  Open Play data access.
   * @param {OpenPlayTokenHelper} tokenHelper Join-token generator.
   */
  constructor(
    private readonly repository: OpenPlayRepository,
    private readonly tokenHelper: OpenPlayTokenHelper,
    private readonly authorizationRepository: AuthorizationRepository,
  ) {}

  /**
   * Lists publicly visible Open Play games (AC-07).
   *
   * @param   {ListOpenPlayQueryDto}          query Filters and page.
   * @returns {Promise<ListOpenPlayResponse>}
   */
  async list(query: ListOpenPlayQueryDto): Promise<ListOpenPlayResponse> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? DEFAULT_OPEN_PLAY_PAGE_SIZE;
    const { records, total } = await this.repository.listPublic({
      now: new Date(),
      venueId: query.venueId,
      from: query.from ? new Date(query.from) : undefined,
      to: query.to ? new Date(query.to) : undefined,
      skip: (page - 1) * pageSize,
      take: pageSize,
    });
    return {
      items: records.map((record) => this.toListing(record)),
      page,
      pageSize,
      total,
    };
  }

  /**
   * Views a game via its join link, regardless of public visibility.
   *
   * @param   {string}      token        The join token.
   * @param   {string|null} viewerUserId Signed-in user id, or `null`.
   * @returns {Promise<OpenPlayByTokenResponse>}
   * @throws  {NotFoundException} Unknown token, or not viewable (cancelled,
   *          venue not ACTIVE, booker deleted; see `openPlayViewableWhere`).
   */
  async getByToken(
    token: string,
    viewerUserId: string | null,
  ): Promise<OpenPlayByTokenResponse> {
    const booking = await this.repository.findViewableByToken(token);
    if (!this.isOpenPlay(booking)) throw new NotFoundException(MSG.NOT_FOUND);
    const seat = viewerUserId
      ? await this.repository.findSeat(booking.id, viewerUserId)
      : null;
    return {
      listing: this.toListing(booking),
      isPublic: booking.isOpenPlayPublic,
      viewer: viewerUserId
        ? { hasSeat: seat !== null, isBooker: seat?.isBooker ?? false }
        : null,
    };
  }

  /**
   * Joins via the join link (AC-04), regardless of visibility.
   *
   * @param   {string} token  The join token.
   * @param   {string} userId The signed-in user.
   * @returns {Promise<JoinOpenPlayResponse>}
   * @throws  {NotFoundException} Unknown token or not viewable (incl. cancelled).
   * @throws  {ConflictException} Started, full, already seated, busy, or lost race.
   */
  async joinByToken(
    token: string,
    userId: string,
  ): Promise<JoinOpenPlayResponse> {
    const booking = await this.repository.findViewableByToken(token);
    if (!this.isOpenPlay(booking)) throw new NotFoundException(MSG.NOT_FOUND);
    return this.join(booking, userId, false);
  }

  /**
   * Joins from the public listing (AC-04). Unknown, non-viewable, and
   * non-listed games all get the identical 404, so a non-listed booking's
   * existence never leaks through this route (the one route where the
   * "same 404" guarantee applies; see the spec's Error Handling).
   *
   * @param   {string} bookingId The booking id.
   * @param   {string} userId    The signed-in user.
   * @returns {Promise<JoinOpenPlayResponse>}
   * @throws  {NotFoundException} Unknown, not viewable, or not public.
   * @throws  {ConflictException} Started, full, already seated, busy, or lost race.
   */
  async joinPublic(
    bookingId: string,
    userId: string,
  ): Promise<JoinOpenPlayResponse> {
    const booking = await this.repository.findViewableById(bookingId);
    if (!this.isOpenPlay(booking) || !booking.isOpenPlayPublic) {
      throw new NotFoundException(MSG.NOT_FOUND);
    }
    return this.join(booking, userId, true);
  }

  /**
   * Releases the caller's (non-booker) seat, until 24h before start (AC-06).
   *
   * @param   {string} bookingId The booking id.
   * @param   {string} userId    The signed-in user.
   * @returns {Promise<void>}
   * @throws  {NotFoundException} Unknown / not Open Play / no seat.
   * @throws  {ConflictException} Cancelled, booker, inside cutoff, or lost race.
   */
  async leave(bookingId: string, userId: string): Promise<void> {
    const booking = await this.loadOpenPlay(bookingId);
    if (booking.isActive !== true) throw new ConflictException(MSG.INACTIVE);

    const seat = await this.repository.findSeat(bookingId, userId);
    if (!seat) throw new NotFoundException(MSG.NO_SEAT);
    if (seat.isBooker) throw new ConflictException(MSG.BOOKER_CANNOT_LEAVE);

    const now = new Date();
    if (isInsideCutoff(booking.bookDate, now)) {
      throw new ConflictException(MSG.LEAVE_CUTOFF);
    }

    const outcome = await this.repository.leaveSeat({ bookingId, userId, now });
    if (outcome.kind === 'NO_SEAT') throw new NotFoundException(MSG.NO_SEAT);
    if (outcome.kind === 'NOT_LEAVABLE') {
      throw new ConflictException(MSG.NO_LONGER_AVAILABLE);
    }
    if (outcome.kind === 'BUSY') throw new ConflictException(MSG.BUSY);
  }

  /**
   * Cancels the whole game; booker only (AC-06).
   *
   * @param   {string} bookingId The booking id.
   * @param   {string} userId    The signed-in user.
   * @returns {Promise<void>}
   * @throws  {NotFoundException}  Unknown / not Open Play.
   * @throws  {ForbiddenException} Caller is not the booker.
   * @throws  {ConflictException}  Cancelled, started, other players inside cutoff, or lost race.
   */
  async cancel(bookingId: string, userId: string): Promise<void> {
    const booking = await this.loadOpenPlay(bookingId);
    if (booking.userId !== userId) throw new ForbiddenException(MSG.NOT_BOOKER);
    if (booking.isActive !== true) throw new ConflictException(MSG.INACTIVE);

    const now = new Date();
    if (hasStarted(booking.bookDate, now)) {
      throw new ConflictException(MSG.STARTED);
    }

    const outcome = await this.repository.cancelBooking({
      bookingId,
      bookerId: userId,
      now,
    });
    if (outcome.kind === 'OTHER_PLAYERS') {
      throw new ConflictException(MSG.CANCEL_CUTOFF);
    }
    if (outcome.kind === 'NOT_CANCELLABLE') {
      throw new ConflictException(MSG.NO_LONGER_AVAILABLE);
    }
    if (outcome.kind === 'BUSY') throw new ConflictException(MSG.BUSY);
  }

  /**
   * Marks an existing booking Open Play; venue staff only (AC-01).
   *
   * @param   {string}            bookingId The booking id.
   * @param   {string}            userId    The signed-in user.
   * @param   {EnableOpenPlayDto} dto       Optional capacity / public flag.
   * @returns {Promise<OpenPlayManageResponse>}
   * @throws  {NotFoundException}  Unknown booking.
   * @throws  {ForbiddenException} Caller is not staff of the booking's venue.
   * @throws  {ConflictException}  Already Open Play, cancelled, started, no booker, or lost race.
   */
  async enable(
    bookingId: string,
    userId: string,
    dto: EnableOpenPlayDto,
  ): Promise<OpenPlayManageResponse> {
    const booking = await this.repository.findById(bookingId);
    if (!booking) throw new NotFoundException(MSG.BOOKING_NOT_FOUND);
    if (!(await this.isStaff(booking, userId))) {
      throw new ForbiddenException(MSG.STAFF_ONLY);
    }
    if (booking.isOpenPlay) throw new ConflictException(MSG.ALREADY_OPEN_PLAY);
    if (booking.isActive !== true) throw new ConflictException(MSG.INACTIVE);

    const now = new Date();
    if (hasStarted(booking.bookDate, now)) {
      throw new ConflictException(MSG.STARTED);
    }
    if (booking.userId === null) throw new ConflictException(MSG.NO_BOOKER);

    const outcome = await this.repository.enableOpenPlay({
      bookingId,
      now,
      capacity: dto.capacity ?? DEFAULT_OPEN_PLAY_CAPACITY,
      isPublic: dto.isPublic ?? false,
      token: this.tokenHelper.generate(),
    });
    if (outcome.kind === 'NOT_ENABLEABLE') {
      throw new ConflictException(MSG.NO_LONGER_AVAILABLE);
    }
    if (outcome.kind === 'BUSY') throw new ConflictException(MSG.BUSY);
    return this.buildManageView(await this.loadOpenPlay(bookingId));
  }

  /**
   * Toggles public listing; booker or venue staff (AC-02).
   *
   * @param   {string}                   bookingId The booking id.
   * @param   {string}                   userId    The signed-in user.
   * @param   {SetOpenPlayVisibilityDto} dto       The new flag.
   * @returns {Promise<OpenPlayManageResponse>}
   * @throws  {NotFoundException}  Unknown booking.
   * @throws  {ForbiddenException} Neither booker nor venue staff.
   * @throws  {ConflictException}  Not Open Play, cancelled, or lost race.
   */
  async setVisibility(
    bookingId: string,
    userId: string,
    dto: SetOpenPlayVisibilityDto,
  ): Promise<OpenPlayManageResponse> {
    const booking = await this.repository.findById(bookingId);
    if (!booking) throw new NotFoundException(MSG.BOOKING_NOT_FOUND);
    await this.assertCanManage(booking, userId);
    if (!this.isOpenPlay(booking))
      throw new ConflictException(MSG.NOT_OPEN_PLAY);
    if (booking.isActive !== true) throw new ConflictException(MSG.INACTIVE);

    const updated = await this.repository.setVisibility(
      bookingId,
      dto.isPublic,
    );
    if (!updated) throw new ConflictException(MSG.NO_LONGER_AVAILABLE);

    return this.buildManageView({ ...booking, isOpenPlayPublic: dto.isPublic });
  }

  /**
   * Management read (token + roster names); booker or venue staff.
   *
   * @param   {string} bookingId The booking id.
   * @param   {string} userId    The signed-in user.
   * @returns {Promise<OpenPlayManageResponse>}
   * @throws  {NotFoundException}  Unknown / not Open Play.
   * @throws  {ForbiddenException} Neither booker nor venue staff.
   */
  async getManageView(
    bookingId: string,
    userId: string,
  ): Promise<OpenPlayManageResponse> {
    const booking = await this.loadOpenPlay(bookingId);
    await this.assertCanManage(booking, userId);
    return this.buildManageView(booking);
  }

  private async join(
    booking: OpenPlayRecord,
    userId: string,
    requirePublic: boolean,
  ): Promise<JoinOpenPlayResponse> {
    // `booking` came from a findViewable* read, so it is already active, at
    // an ACTIVE venue, with a booker. joinSeat re-checks all of it under the lock.
    const now = new Date();
    if (hasStarted(booking.bookDate, now)) {
      throw new ConflictException(MSG.STARTED);
    }

    const outcome = await this.repository.joinSeat({
      bookingId: booking.id,
      userId,
      now,
      requirePublic,
    });
    switch (outcome.kind) {
      case 'JOINED':
        return {
          bookingId: booking.id,
          confirmedSeats: outcome.confirmedSeats,
          capacity: outcome.capacity,
          isFull: isFull(outcome.confirmedSeats, outcome.capacity),
        };
      case 'FULL':
        throw new ConflictException(MSG.FULL);
      case 'ALREADY_SEATED':
        throw new ConflictException(MSG.ALREADY_SEATED);
      case 'NOT_JOINABLE':
        throw new ConflictException(MSG.NO_LONGER_AVAILABLE);
      case 'BUSY':
        throw new ConflictException(MSG.BUSY);
    }
  }

  private async loadOpenPlay(bookingId: string): Promise<OpenPlayRecord> {
    const booking = await this.repository.findById(bookingId);
    if (!this.isOpenPlay(booking)) throw new NotFoundException(MSG.NOT_FOUND);
    return booking;
  }

  private isOpenPlay(
    booking: OpenPlayBookingRecord | null,
  ): booking is OpenPlayRecord {
    return (
      booking !== null &&
      booking.isOpenPlay &&
      booking.openPlayCapacity !== null &&
      booking.openPlayJoinToken !== null
    );
  }

  private isStaff(
    booking: OpenPlayBookingRecord,
    userId: string,
  ): Promise<boolean> {
    return this.authorizationRepository.hasVenueManagerMembership(
      userId,
      booking.court.venue.tenantId,
      booking.venueId,
    );
  }

  private async assertCanManage(
    booking: OpenPlayBookingRecord,
    userId: string,
  ): Promise<void> {
    if (booking.userId === userId) return;
    if (await this.isStaff(booking, userId)) return;
    throw new ForbiddenException(MSG.FORBIDDEN_MANAGE);
  }

  private async buildManageView(
    booking: OpenPlayRecord,
  ): Promise<OpenPlayManageResponse> {
    const roster = await this.repository.findRoster(booking.id);
    return {
      listing: this.toListing(booking),
      isPublic: booking.isOpenPlayPublic,
      isActive: booking.isActive === true,
      joinToken: booking.openPlayJoinToken,
      roster: roster.map((seat) => ({
        name: seat.user.name,
        isBooker: seat.isBooker,
        joinedAt: seat.createdAt.toISOString(),
      })),
    };
  }

  /** Explicit field-by-field mapping. Never spread a record here (AC-08). */
  private toListing(record: OpenPlayListingRecord): OpenPlayListing {
    const capacity = record.openPlayCapacity ?? 0;
    const confirmedSeats = record.confirmedSeats;
    return {
      id: record.id,
      startsAt: record.bookDate.toISOString(),
      venue: {
        id: record.court.venue.id,
        name: record.court.venue.name,
        slug: record.court.venue.slug,
        city: record.court.venue.city,
        timezone: record.court.venue.timezone,
      },
      court: { id: record.court.id, name: record.court.name },
      capacity,
      confirmedSeats,
      isFull: isFull(confirmedSeats, capacity),
    };
  }
}
