import type { CreateCourtBookingResponse } from '@workspace/shared';

export class CreateCourtBooking {
  constructor(
    public bookDate: string,
    public userEmail: string,
    public userId: string,
    public venueId: string,
    public courtId: string,
    public isActive: boolean,
    public referenceId: string,
    public isOpenPlay: boolean,
    public totalPrice: number | null = null,
    public isPaid: boolean = false,
    public openPlayCapacity: number | null = null,
    public isOpenPlayPublic: boolean = false,
    public openPlayJoinToken: string | null = null,
  ) {}
}

export class CreateCourtSchedule {
  constructor(
    public bookedDate: string,
    public courtId: string,
    public userEmail: string,
    public userId: string,
    public dateTimeVacant: Date,
    public hoursBooked: number,
    public venueId: string,
    public isVacant: boolean,
    public isActive: boolean,
    public referenceId: string,
    public createdAt?: Date,
    public updatedAt?: Date,
  ) {}
}

export class CreateBookingResponse implements CreateCourtBookingResponse {
  constructor(
    public statusCode?: number,
    public message?: string,
    public bookingReferenceID?: string,
    public route?: string,
    public error?: any,
    public bookingId?: string,
    public openPlayJoinToken?: string,
  ) {}
}
