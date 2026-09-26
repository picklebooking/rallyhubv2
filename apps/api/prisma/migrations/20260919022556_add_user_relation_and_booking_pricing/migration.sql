/*
  Warnings:

  - Added the required column `userId` to the `CourtBooking` table without a default value. This is not possible if the table is not empty.
  - Added the required column `userId` to the `CourtSchedule` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "CourtBooking" ADD COLUMN     "isPaid" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "totalPrice" DECIMAL(10,2),
ADD COLUMN     "userId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "CourtSchedule" ADD COLUMN     "userId" TEXT NOT NULL;

-- CreateIndex
CREATE INDEX "CourtBooking_userId_idx" ON "CourtBooking"("userId");

-- CreateIndex
CREATE INDEX "CourtSchedule_userId_idx" ON "CourtSchedule"("userId");

-- AddForeignKey
ALTER TABLE "CourtBooking" ADD CONSTRAINT "CourtBooking_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourtSchedule" ADD CONSTRAINT "CourtSchedule_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
