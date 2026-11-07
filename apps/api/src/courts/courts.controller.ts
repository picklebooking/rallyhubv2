import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { Session, type UserSession } from '@thallesp/nestjs-better-auth';
import type { CourtResponse, GetAllCourtsResponse } from '@workspace/shared';
import { CurrentVenue } from '../common/decorators/current-venue.decorator';
import { CreateCourtDto, UpdateCourtDto } from './dto';
import { CourtsService } from './courts.service';

@Controller('courts')
export class CourtsController {
  /**
   * Constructs the `CourtsController`.
   *
   * @param {CourtsService} courtsService The service for handling courts.
   */
  constructor(private readonly courtsService: CourtsService) {}

  /**
   * Lists every court belonging to the current venue.
   *
   * @param   {string}                        venueId The current venue's
   *          id, resolved from the request (subdomain or X-Venue-Id).
   * @returns {Promise<GetAllCourtsResponse>}          The venue's courts.
   */
  @Get()
  findAllByTenant(
    @CurrentVenue() venueId: string,
  ): Promise<GetAllCourtsResponse> {
    return this.courtsService.findAllByVenue(venueId);
  }

  /**
   * Finds a court by its id.
   *
   * @param   {string}                 id The court's id.
   * @returns {Promise<CourtResponse>}    The matching court.
   */
  @Get(':id')
  findById(@Param('id') id: string): Promise<CourtResponse> {
    return this.courtsService.findById(id);
  }

  /**
   * Creates a new court for the current venue.
   *
   * @param   {string}                venueId  The current venue's id,
   *          resolved from the request (subdomain or X-Venue-Id) — never
   *          trusted from the request body.
   * @param   {CreateCourtDto}        dto      The court payload.
   * @returns {Promise<CourtResponse>}          The created court.
   */
  @Post()
  create(
    @Session() session: UserSession,
    @CurrentVenue() venueId: string,
    @Body() dto: CreateCourtDto,
  ): Promise<CourtResponse> {
    return this.courtsService.create(session.user.id, venueId, dto);
  }

  /**
   * Updates an existing court.
   *
   * @param   {string}                 id  The court's id.
   * @param   {UpdateCourtDto}         dto The fields to update.
   * @returns {Promise<CourtResponse>}      The updated court.
   */
  @Patch(':id')
  update(
    @Session() session: UserSession,
    @Param('id') id: string,
    @Body() dto: UpdateCourtDto,
  ): Promise<CourtResponse> {
    return this.courtsService.update(session.user.id, id, dto);
  }

  /**
   * Deletes a court. Fails with a 409 if the court still has bookings.
   *
   * @param   {string}        id The court's id.
   * @returns {Promise<void>}
   */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  delete(
    @Session() session: UserSession,
    @Param('id') id: string,
  ): Promise<void> {
    return this.courtsService.delete(session.user.id, id);
  }
}
