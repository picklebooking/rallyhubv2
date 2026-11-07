import { Injectable } from '@nestjs/common';
import type {
  BookingRules,
  BookingSettingsRecord,
} from '../court-book/booking-rules';
import { weeklyWindowsToRows } from '../court-book/booking-rules';
import { PrismaService } from '../prisma/prisma.service';

const settingsSelect = {
  minDurationHours: true,
  maxDurationHours: true,
  horizonDays: true,
  startAlignment: true,
  openingHours: {
    select: { weekday: true, opensAtMinute: true, closesAtMinute: true },
  },
} as const;

@Injectable()
export class VenueBookingSettingsRepository {
  constructor(private readonly prisma: PrismaService) {}

  findByVenueId(venueId: string): Promise<BookingSettingsRecord | null> {
    return this.prisma.db.venueBookingSettings.findUnique({
      where: { venueId },
      select: settingsSelect,
    });
  }

  replace(
    venueId: string,
    rules: BookingRules,
  ): Promise<BookingSettingsRecord> {
    return this.prisma.db.$transaction(async (tx) => {
      const { weeklyWindows, ...scalars } = rules;
      const settings = await tx.venueBookingSettings.upsert({
        where: { venueId },
        create: { venueId, ...scalars },
        update: scalars,
      });
      await tx.venueOpeningHours.deleteMany({
        where: { settingsId: settings.id },
      });
      const rows = weeklyWindowsToRows(weeklyWindows);
      await tx.venueOpeningHours.createMany({
        data: rows.map((row) => ({ settingsId: settings.id, ...row })),
      });
      return tx.venueBookingSettings.findUniqueOrThrow({
        where: { venueId },
        select: settingsSelect,
      });
    });
  }

  async deleteByVenueId(venueId: string): Promise<void> {
    await this.prisma.db.venueBookingSettings.deleteMany({
      where: { venueId },
    });
  }
}
