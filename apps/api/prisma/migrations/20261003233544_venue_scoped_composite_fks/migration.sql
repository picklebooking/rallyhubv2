
-- DropForeignKey
ALTER TABLE "Court" DROP CONSTRAINT "Court_tenantId_fkey";

-- DropForeignKey
ALTER TABLE "CourtBooking" DROP CONSTRAINT "CourtBooking_courtId_fkey";

-- DropForeignKey
ALTER TABLE "CourtBooking" DROP CONSTRAINT "CourtBooking_tenantId_fkey";

-- DropForeignKey
ALTER TABLE "CourtBooking" DROP CONSTRAINT "CourtBooking_userId_fkey";

-- DropForeignKey
ALTER TABLE "CourtBooking" DROP CONSTRAINT "CourtBooking_venueId_fkey";

-- DropForeignKey
ALTER TABLE "CourtSchedule" DROP CONSTRAINT "CourtSchedule_courtId_fkey";

-- DropForeignKey
ALTER TABLE "CourtSchedule" DROP CONSTRAINT "CourtSchedule_tenantId_fkey";

-- DropForeignKey
ALTER TABLE "CourtSchedule" DROP CONSTRAINT "CourtSchedule_venueId_fkey";

-- DropIndex
DROP INDEX "Court_tenantId_idx";

-- DropIndex
DROP INDEX "CourtBooking_courtId_idx";

-- DropIndex
DROP INDEX "CourtBooking_tenantId_idx";

-- DropIndex
DROP INDEX "CourtBooking_venueId_idx";

-- DropIndex
DROP INDEX "CourtSchedule_courtId_idx";

-- DropIndex
DROP INDEX "CourtSchedule_tenantId_idx";

-- DropIndex
DROP INDEX "CourtSchedule_venueId_idx";

-- AlterTable
ALTER TABLE "Court" DROP COLUMN "tenantId";

-- AlterTable
ALTER TABLE "CourtBooking" DROP COLUMN "tenantId",
ALTER COLUMN "userId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "CourtSchedule" DROP COLUMN "tenantId";

-- CreateIndex
CREATE UNIQUE INDEX "Court_id_venueId_key" ON "Court"("id", "venueId");

-- CreateIndex
CREATE INDEX "CourtBooking_courtId_venueId_idx" ON "CourtBooking"("courtId", "venueId");

-- CreateIndex
CREATE INDEX "CourtSchedule_courtId_venueId_idx" ON "CourtSchedule"("courtId", "venueId");

-- AddForeignKey
ALTER TABLE "CourtBooking" ADD CONSTRAINT "CourtBooking_courtId_venueId_fkey" FOREIGN KEY ("courtId", "venueId") REFERENCES "Court"("id", "venueId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourtBooking" ADD CONSTRAINT "CourtBooking_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourtSchedule" ADD CONSTRAINT "CourtSchedule_courtId_venueId_fkey" FOREIGN KEY ("courtId", "venueId") REFERENCES "Court"("id", "venueId") ON DELETE CASCADE ON UPDATE CASCADE;

