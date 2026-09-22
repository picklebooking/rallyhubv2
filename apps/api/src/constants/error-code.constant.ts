export class ErrorConstant {
  public static readonly HTTP_STATUS_MESSAGES = {
    200: 'Request completed successfully.',
    201: 'Get your paddle ready — your game is waiting for you!',
    204: 'Request completed successfully.',

    400: 'The request contains invalid data.',
    401: 'Authentication is required.',
    403: 'You do not have permission to perform this action.',
    404: 'The requested resource could not be found.',
    409: 'Sorry, this court is no longer available for the selected time. It may have just been booked by another player.',
    422: 'The provided data could not be processed.',
    429: 'Too many requests. Please try again later.',

    500: 'Something went wrong on our server.',
    502: 'The service received an invalid response from an upstream server.',
    503: 'Rallyhub is temporarily unavailable. Please try again later.',
    504: 'The request took too long to complete.',
  };

  public static readonly TENANT_MESSAGES = {
    CREATED:
      'Tenant created! You can now start setting up courts and bookings.',
    UPDATED: 'Tenant details updated successfully.',
    DELETED: 'Tenant removed successfully.',
    NOT_FOUND: 'We couldn’t find that tenant.',
    ALREADY_EXISTS: 'A tenant with these details already exists.',
    ALREADY_DELETED: 'This tenant is already inactive/deleted. No changes were made.',
  };

  public static readonly BOOKING_MESSAGES = {
    CREATED: 'Get your paddle ready — your court is booked!',
    UPDATED: 'Your booking has been updated successfully.',
    CANCELLED: 'Your booking has been cancelled.',
    NOT_FOUND: 'We couldn’t find that booking.',
    COURT_UNAVAILABLE:
      'Sorry, this court is no longer available for the selected time. It may have just been booked by another player.',
  };

  public static readonly STATUS_CODES = {
    CREATED: 201,
    CONFLICT: 409,
    SUCCESS: 200,
    SERVER_ERROR: 500,
  };
}
