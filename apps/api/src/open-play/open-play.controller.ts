import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  AllowAnonymous,
  OptionalAuth,
  Session,
  type UserSession,
} from '@thallesp/nestjs-better-auth';
import type {
  JoinOpenPlayResponse,
  ListOpenPlayResponse,
  OpenPlayByTokenResponse,
  OpenPlayManageResponse,
} from '@workspace/shared';
import { MainRoute } from '../constants/routes.constant';
import {
  EnableOpenPlayDto,
  ListOpenPlayQueryDto,
  SetOpenPlayVisibilityDto,
} from './dto';
import { OpenPlayService } from './open-play.service';

/**
 * Open Play routes. The booking's venue/tenant always comes from the
 * booking itself, never from `@CurrentVenue()` / `@CurrentTenant()`.
 */
@Controller({
  path: MainRoute.MAIN_ROUTE.OPEN_PLAY,
  version: MainRoute.API_VERSIONS.VERSION_ONE,
})
export class OpenPlayController {
  /**
   * Constructs the `OpenPlayController`.
   *
   * @param {OpenPlayService} openPlayService The Open Play service.
   */
  constructor(private readonly openPlayService: OpenPlayService) {}

  /**
   * Public discovery listing (no login).
   *
   * @param   {ListOpenPlayQueryDto}          query Filters and page.
   * @returns {Promise<ListOpenPlayResponse>}
   */
  @Get()
  @AllowAnonymous()
  list(@Query() query: ListOpenPlayQueryDto): Promise<ListOpenPlayResponse> {
    return this.openPlayService.list(query);
  }

  /**
   * View a game by join link; viewer state when signed in.
   *
   * @param   {string}              token   The join token.
   * @param   {UserSession | null}  session The session; Better Auth sets
   *          `request.session` to `null` (not `undefined`) when signed out.
   * @returns {Promise<OpenPlayByTokenResponse>}
   */
  @Get('join/:token')
  @OptionalAuth()
  getByToken(
    @Param('token') token: string,
    @Session() session: UserSession | null,
  ): Promise<OpenPlayByTokenResponse> {
    return this.openPlayService.getByToken(token, session?.user.id ?? null);
  }

  /**
   * Join via link.
   *
   * @param   {string}      token   The join token.
   * @param   {UserSession} session The session.
   * @returns {Promise<JoinOpenPlayResponse>}
   */
  @Post('join/:token')
  joinByToken(
    @Param('token') token: string,
    @Session() session: UserSession,
  ): Promise<JoinOpenPlayResponse> {
    return this.openPlayService.joinByToken(token, session.user.id);
  }

  /**
   * Management read (booker or venue staff).
   *
   * @param   {string}      bookingId The booking id.
   * @param   {UserSession} session   The session.
   * @returns {Promise<OpenPlayManageResponse>}
   */
  @Get(':bookingId')
  getManageView(
    @Param('bookingId', ParseUUIDPipe) bookingId: string,
    @Session() session: UserSession,
  ): Promise<OpenPlayManageResponse> {
    return this.openPlayService.getManageView(bookingId, session.user.id);
  }

  /**
   * Join from the public listing.
   *
   * @param   {string}      bookingId The booking id.
   * @param   {UserSession} session   The session.
   * @returns {Promise<JoinOpenPlayResponse>}
   */
  @Post(':bookingId/join')
  joinPublic(
    @Param('bookingId', ParseUUIDPipe) bookingId: string,
    @Session() session: UserSession,
  ): Promise<JoinOpenPlayResponse> {
    return this.openPlayService.joinPublic(bookingId, session.user.id);
  }

  /**
   * Leave a game (non-booker).
   *
   * @param   {string}      bookingId The booking id.
   * @param   {UserSession} session   The session.
   * @returns {Promise<void>}
   */
  @Delete(':bookingId/seat')
  @HttpCode(HttpStatus.NO_CONTENT)
  leave(
    @Param('bookingId', ParseUUIDPipe) bookingId: string,
    @Session() session: UserSession,
  ): Promise<void> {
    return this.openPlayService.leave(bookingId, session.user.id);
  }

  /**
   * Cancel the whole game (booker).
   *
   * @param   {string}      bookingId The booking id.
   * @param   {UserSession} session   The session.
   * @returns {Promise<void>}
   */
  @Post(':bookingId/cancel')
  @HttpCode(HttpStatus.NO_CONTENT)
  cancel(
    @Param('bookingId', ParseUUIDPipe) bookingId: string,
    @Session() session: UserSession,
  ): Promise<void> {
    return this.openPlayService.cancel(bookingId, session.user.id);
  }

  /**
   * Mark an existing booking Open Play (venue staff).
   *
   * @param   {string}            bookingId The booking id.
   * @param   {EnableOpenPlayDto} dto       Capacity / public flag.
   * @param   {UserSession}       session   The session.
   * @returns {Promise<OpenPlayManageResponse>}
   */
  @Patch(':bookingId/enable')
  enable(
    @Param('bookingId', ParseUUIDPipe) bookingId: string,
    @Body() dto: EnableOpenPlayDto,
    @Session() session: UserSession,
  ): Promise<OpenPlayManageResponse> {
    return this.openPlayService.enable(bookingId, session.user.id, dto);
  }

  /**
   * Toggle public listing (booker or venue staff).
   *
   * @param   {string}                   bookingId The booking id.
   * @param   {SetOpenPlayVisibilityDto} dto       The new flag.
   * @param   {UserSession}              session   The session.
   * @returns {Promise<OpenPlayManageResponse>}
   */
  @Patch(':bookingId/visibility')
  setVisibility(
    @Param('bookingId', ParseUUIDPipe) bookingId: string,
    @Body() dto: SetOpenPlayVisibilityDto,
    @Session() session: UserSession,
  ): Promise<OpenPlayManageResponse> {
    return this.openPlayService.setVisibility(bookingId, session.user.id, dto);
  }
}
