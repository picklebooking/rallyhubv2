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
import type {
  GetAllVenuesResponse,
  VenueBySlugResponse,
  VenueResponse,
} from '@workspace/shared';
import { CurrentTenant } from '../common/decorators/current-tenant.decorator';
import { CreateVenueDto, UpdateVenueDto } from './dto';
import { VenuesService } from './venues.service';

@Controller('venues')
export class VenuesController {
  /**
   * Constructs the `VenuesController`.
   *
   * @param {VenuesService} venuesService The service for handling venues.
   */
  constructor(private readonly venuesService: VenuesService) {}

  /**
   * Lists every venue, newest first.
   *
   * @returns {Promise<GetAllVenuesResponse>} All venues.
   */
  @Get()
  findAll(): Promise<GetAllVenuesResponse> {
    return this.venuesService.findAll();
  }

  /**
   * Finds a venue by its subdomain slug.
   *
   * @param   {string}                        slug The venue's slug.
   * @returns {Promise<VenueBySlugResponse>}        The matching venue.
   */
  @Get('by-slug/:slug')
  findBySlug(@Param('slug') slug: string): Promise<VenueBySlugResponse> {
    return this.venuesService.findBySlug(slug);
  }

  /**
   * Finds a venue by its id.
   *
   * @param   {string}                 id The venue's id.
   * @returns {Promise<VenueResponse>}    The matching venue.
   */
  @Get(':id')
  findById(@Param('id') id: string): Promise<VenueResponse> {
    return this.venuesService.findById(id);
  }

  /**
   * Creates a new venue for the current tenant.
   *
   * @param   {string}                tenantId The current tenant's id,
   *          resolved from the request (X-Tenant-Id) — never trusted from
   *          the request body. There is no venue in scope yet at creation
   *          time, so `@CurrentVenue()` cannot be used here.
   * @param   {CreateVenueDto}        dto      The venue payload.
   * @returns {Promise<VenueResponse>}          The created venue.
   */
  @Post()
  create(
    @Session() session: UserSession,
    @CurrentTenant() tenantId: string,
    @Body() dto: CreateVenueDto,
  ): Promise<VenueResponse> {
    return this.venuesService.create(session.user.id, tenantId, dto);
  }

  /**
   * Updates an existing venue.
   *
   * @param   {string}                 id  The venue's id.
   * @param   {UpdateVenueDto}         dto The fields to update.
   * @returns {Promise<VenueResponse>}      The updated venue.
   */
  @Patch(':id')
  update(
    @Session() session: UserSession,
    @Param('id') id: string,
    @Body() dto: UpdateVenueDto,
  ): Promise<VenueResponse> {
    return this.venuesService.update(session.user.id, id, dto);
  }

  /**
   * Deletes a venue. Fails with a 409 if the venue's courts still have
   * bookings.
   *
   * @param   {string}        id The venue's id.
   * @returns {Promise<void>}
   */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  delete(
    @Session() session: UserSession,
    @Param('id') id: string,
  ): Promise<void> {
    return this.venuesService.delete(session.user.id, id);
  }
}
