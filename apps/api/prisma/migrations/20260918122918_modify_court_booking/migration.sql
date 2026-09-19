/*
  Warnings:

  - A unique constraint covering the columns `[referenceId]` on the table `CourtBooking` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "CourtBooking_referenceId_idx";

-- CreateIndex
CREATE UNIQUE INDEX "CourtBooking_referenceId_key" ON "CourtBooking"("referenceId");
