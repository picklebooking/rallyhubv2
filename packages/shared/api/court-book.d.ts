export type CreateCourtBookingRequest = {
  date: string
  email: string
  courtId: string
  rentDuration: number
  isOpenPlay: boolean
  /** Seats including the booker's. Defaults to 4 server-side. Only valid when `isOpenPlay`. */
  openPlayCapacity?: number
  /** Only valid when `isOpenPlay`. Defaults to `false`. */
  isOpenPlayPublic?: boolean
}

export type CreateCourtBookingResponse = {
  statusCode?: number
  message?: string
  bookingReferenceID?: string
  /** Present only for Open Play bookings. Needed for `GET/PATCH/POST /v1/open-play/:bookingId/...`. */
  bookingId?: string
  /** Present only for Open Play bookings. */
  openPlayJoinToken?: string
}
