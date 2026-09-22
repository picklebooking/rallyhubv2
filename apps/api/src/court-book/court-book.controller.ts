import { Body, Controller, Post } from '@nestjs/common';
import { MainRoute } from "../constants/routes.constant";
import { CreateBookingResponse } from '../models/create-booking.model';
import { CurrentVenue } from '../common/decorators/current-venue.decorator';
import { CourtBookService } from './court-book.service';
import { CreateCourtBookingDto } from './dto/create-court-booking.dto';

@Controller({ path: MainRoute.MAIN_ROUTE.BOOKING, version: MainRoute.API_VERSIONS.VERSION_ONE})
export class CourtBookController {
  /**
   * Constructs the `CourtBookController`.
   *
   * @param  {CourtBookService}  courtBookService  The service for handling court.
   */
  constructor(private readonly courtBookService: CourtBookService) {}

  @Post(MainRoute.SUB_ROUTE.CREATE_BOOKING)
  /**
   * Creates a new court booking.
   *
   * @param   {string}                     venueId      The current venue's
   *          id, resolved from the request context — never trusted from
   *          the request body.
   * @param   {CreateCourtBookingDto}      requestBody  The booking payload.
   * @returns {Promise<CreateBookingResponse>}          The created booking.
   */
  public async createBooking(
    @CurrentVenue() venueId: string,
    @Body() requestBody: CreateCourtBookingDto,
  ): Promise<CreateBookingResponse> {
    return this.courtBookService.createBookingRoute(venueId, requestBody);
  }
}
