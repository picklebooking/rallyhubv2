export class ErrorCodeConstant {
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
  }

  public static readonly STATUS_CODES = {
    CREATED: 201,
    CONFLICT: 409
  }
}
