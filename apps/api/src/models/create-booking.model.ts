export class CreateCourtBooking {
  constructor(
    public bookDate: string,
    public userEmail: string,
    public tenantId: string,
    public courtId: string,
    public isActive: boolean,
    public referenceId: string,
    public isOpenPlay: boolean
  ) {}
}

export class CreateCourtSchedule {
  constructor(
    public bookedDate: string,
    public courtId: string,
    public userEmail: string,
    public dateTimeVacant: Date,
    public hoursBooked: number,
    public tenantId: string,
    public isVacant: boolean,
    public isActive: boolean,
    public referenceId: string,
    public createdAt?: Date,
    public updatedAt?: Date,
  ) {}
}

export class CreateBookingResponse {
  constructor(
    public statusCode?: number,
    public message?: string,
    public bookingReferenceID?: string,
    public route?: string,
    public error?: any,
  ) {}
}
