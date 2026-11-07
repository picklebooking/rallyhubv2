-- CreateEnum
CREATE TYPE "BookingStartAlignment" AS ENUM ('HOUR', 'HALF_HOUR');

-- CreateEnum
CREATE TYPE "Weekday" AS ENUM ('MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY');

-- CreateTable
CREATE TABLE "VenueBookingSettings" (
    "id" TEXT NOT NULL,
    "venueId" TEXT NOT NULL,
    "minDurationHours" INTEGER NOT NULL,
    "maxDurationHours" INTEGER NOT NULL,
    "horizonDays" INTEGER NOT NULL,
    "startAlignment" "BookingStartAlignment" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VenueBookingSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VenueOpeningHours" (
    "id" TEXT NOT NULL,
    "settingsId" TEXT NOT NULL,
    "weekday" "Weekday" NOT NULL,
    "opensAtMinute" INTEGER NOT NULL,
    "closesAtMinute" INTEGER NOT NULL,

    CONSTRAINT "VenueOpeningHours_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "VenueBookingSettings_venueId_key" ON "VenueBookingSettings"("venueId");

-- CreateIndex
CREATE UNIQUE INDEX "VenueOpeningHours_settingsId_weekday_key" ON "VenueOpeningHours"("settingsId", "weekday");

-- AddForeignKey
ALTER TABLE "VenueBookingSettings" ADD CONSTRAINT "VenueBookingSettings_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "Venue"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VenueOpeningHours" ADD CONSTRAINT "VenueOpeningHours_settingsId_fkey" FOREIGN KEY ("settingsId") REFERENCES "VenueBookingSettings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
