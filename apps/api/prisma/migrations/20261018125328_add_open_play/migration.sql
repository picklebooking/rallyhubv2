-- AlterTable
ALTER TABLE "CourtBooking" ADD COLUMN     "isOpenPlayPublic" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "openPlayCapacity" INTEGER,
ADD COLUMN     "openPlayJoinToken" TEXT;

-- CreateTable
CREATE TABLE "OpenPlaySeat" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "isBooker" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OpenPlaySeat_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OpenPlaySeat_userId_idx" ON "OpenPlaySeat"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "OpenPlaySeat_bookingId_userId_key" ON "OpenPlaySeat"("bookingId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "CourtBooking_openPlayJoinToken_key" ON "CourtBooking"("openPlayJoinToken");

-- CreateIndex
CREATE INDEX "CourtBooking_isOpenPlay_isOpenPlayPublic_isActive_bookDate_idx" ON "CourtBooking"("isOpenPlay", "isOpenPlayPublic", "isActive", "bookDate");

-- CreateIndex
CREATE INDEX "CourtBooking_venueId_bookDate_idx" ON "CourtBooking"("venueId", "bookDate");

-- AddForeignKey
ALTER TABLE "OpenPlaySeat" ADD CONSTRAINT "OpenPlaySeat_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "CourtBooking"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OpenPlaySeat" ADD CONSTRAINT "OpenPlaySeat_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
