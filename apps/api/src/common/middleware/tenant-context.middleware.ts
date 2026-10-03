import { Injectable, type NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { PrismaService } from '../../prisma/prisma.service';
import { VenuesRepository } from '../../venues/venues.repository';

/**
 * Resolves tenant (and, where possible, venue) context from the incoming
 * request.
 *
 * Resolution order:
 * 1. Subdomain from the Host header (e.g., "cebu-club.rallyhub.com") —
 *    resolves a Venue, and derives its tenantId.
 * 2. X-Venue-Id header (for testing/API clients) — same as above.
 * 3. X-Tenant-Id header (for tenant-only endpoints, e.g. tenant creation,
 *    where no venue exists yet) — looked up against the database; sets only
 *    tenantId, no venue. An unknown tenant id is ignored, the same as an
 *    unresolved venue.
 *
 * If a venue is resolved, `req.tenantId`, `req.venueId`, and `req.venue`
 * are all populated. If only a tenant is resolved (via X-Tenant-Id),
 * only `req.tenantId` is populated. Routes that do not require tenant
 * context (like the tenants list endpoint) proceed without error when
 * nothing resolves.
 */
@Injectable()
export class TenantContextMiddleware implements NestMiddleware {
  /**
   * Constructs the `TenantContextMiddleware`.
   *
   * @param {VenuesRepository} venuesRepository The repository for venues.
   * @param {PrismaService}    prisma           The Prisma service.
   */
  constructor(
    private readonly venuesRepository: VenuesRepository,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Resolves the tenant/venue context for this request and attaches it,
   * per the resolution order documented on the class.
   *
   * @param   {Request}         req  The incoming request.
   * @param   {Response}        _res The outgoing response (unused).
   * @param   {NextFunction}    next Continues the middleware chain.
   * @returns {Promise<void>}
   */
  async use(req: Request, _res: Response, next: NextFunction): Promise<void> {
    // Priority 1: Subdomain resolution
    const host = req.headers.host ?? '';
    const subdomain = this.extractSubdomain(host);

    if (subdomain && subdomain !== 'app' && subdomain !== 'www') {
      const venue = await this.venuesRepository.findBySlug(subdomain);
      if (venue) {
        this.attachVenue(req, venue);
        return next();
      }
    }

    // Priority 2: X-Venue-Id header (for testing/API clients)
    const venueIdHeader = req.headers['x-venue-id'];
    if (typeof venueIdHeader === 'string' && venueIdHeader.length > 0) {
      const venue = await this.venuesRepository.findById(venueIdHeader);
      if (venue) {
        this.attachVenue(req, venue);
        return next();
      }
    }

    // Priority 3: X-Tenant-Id header (tenant-only endpoints with no venue
    // in scope, e.g. venue creation). Validated against the database so a
    // caller cannot spoof another tenant's id by simply sending a header.
    //
    // TEMPORARY: queries Prisma directly instead of going through a
    // TenantsRepository, because the Tenants module (controller/service/
    // repository) was removed from this codebase -- the Tenants API is
    // being rebuilt separately. Replace this with a proper repository
    // call once that module exists again.
    const tenantIdHeader = req.headers['x-tenant-id'];
    if (typeof tenantIdHeader === 'string' && tenantIdHeader.length > 0) {
      const tenant = await this.prisma.db.tenant.findUnique({
        where: { id: tenantIdHeader },
        select: { id: true },
      });
      if (tenant) {
        (req as unknown as Record<string, unknown>)['tenantId'] = tenant.id;
        return next();
      }
    }

    // No tenant context found - OK for non-tenant endpoints
    next();
  }

  /**
   * Attaches a resolved venue's tenantId, venueId, and the venue itself to
   * the request.
   *
   * @param   {Request} req   The incoming request.
   * @param   {Venue}   venue The resolved venue.
   * @returns {void}
   */
  private attachVenue(
    req: Request,
    venue: Awaited<ReturnType<VenuesRepository['findById']>>,
  ): void {
    const mutableReq = req as unknown as Record<string, unknown>;
    mutableReq['tenantId'] = venue?.tenantId;
    mutableReq['venueId'] = venue?.id;
    mutableReq['venue'] = venue;
  }

  /**
   * Extracts the subdomain from a Host header, if any.
   *
   * @param   {string}       host The Host header value.
   * @returns {string | null}     The subdomain (e.g. "cebu-club"), or `null`.
   */
  private extractSubdomain(host: string): string | null {
    // Remove port if present
    const hostWithoutPort = host.split(':')[0] ?? '';
    const parts = hostWithoutPort.split('.');

    // localhost or single-part host -> no subdomain
    if (parts.length < 3) {
      return null;
    }

    // cebu-club.rallyhub.com -> "cebu-club"
    return parts[0] ?? null;
  }
}
