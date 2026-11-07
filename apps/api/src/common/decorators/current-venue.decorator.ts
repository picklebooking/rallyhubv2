import {
  BadRequestException,
  createParamDecorator,
  type ExecutionContext,
} from '@nestjs/common';
import type { Request } from 'express';

/**
 * Extracts the venueId from the request, which is set by
 * TenantContextMiddleware from either a subdomain or X-Venue-Id header.
 *
 * Throws BadRequestException if no venue context is present.
 */
export const CurrentVenue = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string => {
    const request = ctx.switchToHttp().getRequest<Request>();
    const venueId = (request as unknown as Record<string, unknown>)['venueId'];

    if (!venueId || typeof venueId !== 'string') {
      throw new BadRequestException(
        'Venue context required. This endpoint must be called with a valid venue in scope (subdomain or X-Venue-Id header).',
      );
    }

    return venueId;
  },
);
