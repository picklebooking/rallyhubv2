import { Body, Controller, Post } from '@nestjs/common';
import { MainRoute } from "../../constants/routes.constant";
import { CreateBookingResponse } from 'src/models/create-booking.model';
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

  @Post(MainRoute.SUB_ROUTE.CREATE)
  /**
   * Creates a new court booking.
   *
   * @param   {CourtBooking}               requestBody  The booking payload.
   * @returns {Promise<CreateBookingDto>}               The created booking.
   */
  public async createBooking(
    @Body() requestBody: CreateCourtBookingDto,
  ): Promise<CreateBookingResponse> {
    return this.courtBookService.createBookingRoute(requestBody);
  }
}
