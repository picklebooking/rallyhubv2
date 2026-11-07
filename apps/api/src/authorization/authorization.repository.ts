import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AuthorizationRepository {
  constructor(private readonly prisma: PrismaService) {}

  async isPlatformAdmin(userId: string): Promise<boolean> {
    const user = await this.prisma.db.user.findUnique({
      where: { id: userId },
      select: { isPlatformAdmin: true },
    });
    return user?.isPlatformAdmin ?? false;
  }

  async hasTenantOwnerMembership(
    userId: string,
    tenantId: string,
  ): Promise<boolean> {
    const member = await this.prisma.db.tenantMember.findFirst({
      where: { userId, tenantId, isActive: true, role: 'OWNER', venueId: null },
      select: { id: true },
    });
    return member !== null;
  }

  async hasTenantWideMembership(
    userId: string,
    tenantId: string,
  ): Promise<boolean> {
    const member = await this.prisma.db.tenantMember.findFirst({
      where: {
        userId,
        tenantId,
        isActive: true,
        role: { in: ['OWNER', 'STAFF'] },
        venueId: null,
      },
      select: { id: true },
    });
    return member !== null;
  }

  async hasVenueManagerMembership(
    userId: string,
    tenantId: string,
    venueId: string,
  ): Promise<boolean> {
    const member = await this.prisma.db.tenantMember.findFirst({
      where: {
        userId,
        tenantId,
        isActive: true,
        role: { in: ['OWNER', 'STAFF'] },
        OR: [{ venueId: null }, { venueId }],
      },
      select: { id: true },
    });
    return member !== null;
  }
}
