import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client';
import type {
  CourtStatus,
  TenantStatus,
  VenueStatus,
  Weekday,
} from '../generated/prisma/client';
import { signUpAndSignIn, type HttpTestSession } from './auth-session';
import { getTestDatabaseUrl } from './http-app';

export type FixtureBookingSettings = {
  minDurationHours: number;
  maxDurationHours: number;
  horizonDays: number;
  startAlignment: 'HOUR' | 'HALF_HOUR';
  hours: {
    weekday: Weekday;
    opensAtMinute: number;
    closesAtMinute: number;
  }[];
};

/** One instance per suite; every deletion is limited to explicitly tracked IDs. */
export class HttpFixtures {
  readonly db: PrismaClient;
  private readonly suffix = randomUUID();
  private readonly userIds = new Set<string>();
  private readonly tenantIds: string[] = [];
  private readonly venueIds: string[] = [];
  private readonly courtIds: string[] = [];
  private readonly memberIds: string[] = [];

  constructor() {
    this.db = new PrismaClient({ adapter: new PrismaPg(getTestDatabaseUrl()) });
  }

  trackUser(userId: string): void {
    this.userIds.add(userId);
  }

  /** Signs up a real user and tracks it before any later step can throw. */
  signUp(
    app: INestApplication,
    opts: { email?: string; name?: string } = {},
  ): Promise<HttpTestSession> {
    return signUpAndSignIn(app, {
      ...opts,
      onUserCreated: (userId) => this.trackUser(userId),
    });
  }

  trackTenant(tenantId: string): void {
    this.tenantIds.push(tenantId);
  }

  async createTenant(
    status: TenantStatus = 'PENDING',
    opts: { email?: string } = {},
  ): Promise<{ id: string }> {
    const tenant = await this.db.tenant.create({
      data: { name: `HTTP tenant ${this.suffix}`, status, ...opts },
      select: { id: true },
    });
    this.tenantIds.push(tenant.id);
    return tenant;
  }

  async createVenue(
    tenantId: string,
    opts: { status?: VenueStatus; timezone?: string } = {},
  ): Promise<{ id: string }> {
    const venue = await this.db.venue.create({
      data: {
        tenantId,
        name: `HTTP venue ${this.suffix}`,
        slug: `http-${randomUUID()}`,
        ...opts,
      },
      select: { id: true },
    });
    this.venueIds.push(venue.id);
    return venue;
  }

  async createCourt(
    venueId: string,
    status: CourtStatus = 'ACTIVE',
  ): Promise<{ id: string }> {
    const court = await this.db.court.create({
      data: { venueId, name: `HTTP court ${this.suffix}`, status },
      select: { id: true },
    });
    this.courtIds.push(court.id);
    return court;
  }

  async createBookableCourt(
    opts: { timezone?: string } = {},
  ): Promise<{ tenantId: string; venueId: string; courtId: string }> {
    const tenant = await this.createTenant('ACTIVE');
    const venue = await this.createVenue(tenant.id, {
      ...opts,
      status: 'ACTIVE',
    });
    const court = await this.createCourt(venue.id);
    return { tenantId: tenant.id, venueId: venue.id, courtId: court.id };
  }

  async setBookingSettings(
    venueId: string,
    input: FixtureBookingSettings,
  ): Promise<void> {
    const { hours, ...rules } = input;
    await this.db.venueBookingSettings.upsert({
      where: { venueId },
      create: { venueId, ...rules, openingHours: { create: hours } },
      update: {
        ...rules,
        openingHours: { deleteMany: {}, create: hours },
      },
    });
  }

  async addMember(
    userId: string,
    tenantId: string,
    role: 'OWNER' | 'STAFF',
    venueId: string | null = null,
    isActive = true,
  ): Promise<{ id: string }> {
    const member = await this.db.tenantMember.create({
      data: { userId, tenantId, role, venueId, isActive },
      select: { id: true },
    });
    this.memberIds.push(member.id);
    return member;
  }

  async verifyEmail(userId: string): Promise<void> {
    await this.db.user.update({
      where: { id: userId },
      data: { emailVerified: true },
    });
  }

  async makePlatformAdmin(userId: string): Promise<void> {
    await this.db.user.update({
      where: { id: userId },
      data: { isPlatformAdmin: true },
    });
  }

  async getPlatformAdmin(userId: string): Promise<boolean> {
    const user = await this.db.user.findUniqueOrThrow({
      where: { id: userId },
      select: { isPlatformAdmin: true },
    });
    return user.isPlatformAdmin;
  }

  async cleanup(): Promise<void> {
    try {
      await this.db.openPlaySeat.deleteMany({
        where: { booking: { courtId: { in: this.courtIds } } },
      });
      await this.db.courtBooking.deleteMany({
        where: { courtId: { in: this.courtIds } },
      });
      await this.db.courtSchedule.deleteMany({
        where: { courtId: { in: this.courtIds } },
      });
      await this.db.tenantMember.deleteMany({
        where: { id: { in: this.memberIds } },
      });
      await this.db.court.deleteMany({ where: { id: { in: this.courtIds } } });
      await this.db.venue.deleteMany({ where: { id: { in: this.venueIds } } });
      await this.db.tenant.deleteMany({
        where: { id: { in: this.tenantIds } },
      });
      // Account and session rows cascade only for the signup users we tracked.
      await this.db.user.deleteMany({
        where: { id: { in: [...this.userIds] } },
      });
    } finally {
      await this.db.$disconnect();
    }
  }
}

/** Always closes the app, even when fixture cleanup fails or setup never finished. */
export async function teardownHttpSuite(
  app: INestApplication | undefined,
  fixtures: HttpFixtures | undefined,
): Promise<void> {
  try {
    await fixtures?.cleanup();
  } finally {
    await app?.close();
  }
}
