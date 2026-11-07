import type { Prisma } from '../generated/prisma/client';

/** The shared court, venue and tenant status policy for booking and Open Play. */
export function bookableCourtWhere(): Prisma.CourtWhereInput {
  return {
    status: 'ACTIVE',
    venue: { status: 'ACTIVE', tenant: { status: 'ACTIVE' } },
  };
}
