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
    NOT_FOUND: 'We couldn\'t find that tenant.',
    ALREADY_EXISTS: 'A tenant with these details already exists.',
    ALREADY_DELETED:
      'This tenant is already inactive/deleted. No changes were made.',
  };

  public static readonly BOOKING_MESSAGES = {
    CREATED: 'Get your paddle ready — your court is booked!',
    UPDATED: 'Your booking has been updated successfully.',
    CANCELLED: 'Your booking has been cancelled.',
    NOT_FOUND: 'We couldn\'t find that booking.',
    COURT_UNAVAILABLE:
      'Sorry, this court is no longer available for the selected time. It may have just been booked by another player.',
  };

  public static readonly OPEN_PLAY_MESSAGES = {
    NOT_FOUND: "We couldn't find that open play game.",
    BOOKING_NOT_FOUND: "We couldn't find that booking.",
    INVALID_PRIVATE_OPTIONS:
      'Capacity and public listing can only be set on an open play booking.',
    EMAIL_MISMATCH:
      'Open play bookings can only be created for your own account.',
    BUSY: 'Lots of players are trying this game right now. Please try again in a moment.',
    NOT_OPEN_PLAY:
      'This booking is not an open play game, so it cannot be publicly listed.',
    ALREADY_OPEN_PLAY: 'This booking is already an open play game.',
    NO_BOOKER:
      'This booking has no account holder to take the first seat, so it cannot become open play.',
    INACTIVE: 'This open play game has been cancelled.',
    STARTED: 'This open play game has already started.',
    FULL: 'This open play game is full.',
    ALREADY_SEATED: 'You already have a seat in this game.',
    NO_SEAT: 'You do not have a seat in this game.',
    BOOKER_CANNOT_LEAVE:
      'You booked this court. Cancel the booking instead of leaving it.',
    LEAVE_CUTOFF:
      'Seats can only be released up to 24 hours before the game starts.',
    CANCEL_CUTOFF:
      'This booking cannot be cancelled within 24 hours of the start time while other players hold seats.',
    NO_LONGER_AVAILABLE:
      'This game changed while we were processing your request. Refresh and try again.',
    NOT_BOOKER: 'Only the player who booked this court can cancel it.',
    FORBIDDEN_MANAGE:
      'Only the booker or staff of this venue can change this game.',
    STAFF_ONLY:
      'Only staff of this venue can turn an existing booking into open play.',
  };

  public static readonly TENANT_MEMBER_MESSAGES = {
    CREATED: "Member added successfully! They're now part of your team.",
    FOUND: 'Member details retrieved successfully.',
    LIST_FOUND: 'Team members retrieved successfully.',
    EMPTY: 'No members yet. Start building your team!',
    UPDATED: 'Member details updated successfully!',
    DELETED: 'Member removed successfully from your team.',
    NOT_FOUND: "We couldn't find the member you're looking for.",
    TENANT_NOT_FOUND: 'The selected tenant could not be found.',
    ALREADY_EXISTS: 'This member already belongs to your team.',
    INVALID_DATA:
      'Some member details are invalid. Please review and try again.',
    UNAUTHORIZED: 'Please log in to manage your RallyHub team.',
    FORBIDDEN: "You don't have permission to manage members of this tenant.",
    DELETE_FORBIDDEN: "You don't have permission to remove this member.",
    INACTIVE: 'This member is currently inactive.',
    ALREADY_INACTIVE: 'This member has already been deactivated.',
    ACTIVATED: 'Member reactivated successfully!',
    DEACTIVATED: 'Member deactivated successfully.',
    INTERNAL_ERROR:
      'Something went wrong while managing this member. Please try again later.',
    REACTIVATE: 'Member is reactivated',
  };

  public static readonly STATUS_CODES = {
    CREATED: 201,
    CONFLICT: 409,
    SUCCESS: 200,
    SERVER_ERROR: 500,
  };
}
