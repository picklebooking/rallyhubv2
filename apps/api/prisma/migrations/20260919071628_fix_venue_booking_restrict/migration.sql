-- DropForeignKey
ALTER TABLE "CourtBooking" DROP CONSTRAINT "CourtBooking_venueId_fkey";

-- AddForeignKey
ALTER TABLE "CourtBooking" ADD CONSTRAINT "CourtBooking_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "Venue"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
