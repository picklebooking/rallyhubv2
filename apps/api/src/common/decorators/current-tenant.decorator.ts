import {
  BadRequestException,
  createParamDecorator,
  type ExecutionContext,
} from '@nestjs/common';
import type { Request } from 'express';

/**
 * Extracts the tenantId from the request, which is set by
 * TenantContextMiddleware from either a subdomain or X-Tenant-Id header.
 *
 * Throws BadRequestException if no tenant context is present.
 */
export const CurrentTenant = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string => {
    const request = ctx.switchToHttp().getRequest<Request>();
    const tenantId: string = request['headers']?.tenantid as string;

    if (!tenantId || 'string' !== typeof tenantId) {
      throw new BadRequestException(
        'Tenant context required. This endpoint must be called with a valid tenant context (subdomain or X-Tenant-Id header).',
      );
    }

    return tenantId;
  },
);
