-- CreateTable
CREATE TABLE "CourtBooking" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "courtId" TEXT NOT NULL,
    "userEmail" TEXT NOT NULL,
    "bookDate" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3),
    "isActive" BOOLEAN,
    "referenceId" TEXT NOT NULL,
    "isOpenPlay" BOOLEAN NOT NULL,

    CONSTRAINT "CourtBooking_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CourtSchedule" (
    "id" TEXT NOT NULL,
    "courtId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userEmail" TEXT NOT NULL,
    "bookedDate" TEXT NOT NULL,
    "isVacant" BOOLEAN NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3),
    "isActive" BOOLEAN,
    "hoursBooked" INTEGER NOT NULL,
    "dateTimeVacant" TEXT NOT NULL,
    "referenceId" TEXT NOT NULL,

    CONSTRAINT "CourtSchedule_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CourtBooking_id_idx" ON "CourtBooking"("id");

-- CreateIndex
CREATE INDEX "CourtBooking_tenantId_idx" ON "CourtBooking"("tenantId");

-- CreateIndex
CREATE INDEX "CourtBooking_courtId_idx" ON "CourtBooking"("courtId");

-- CreateIndex
CREATE INDEX "CourtBooking_userEmail_idx" ON "CourtBooking"("userEmail");

-- CreateIndex
CREATE INDEX "CourtBooking_isActive_idx" ON "CourtBooking"("isActive");

-- CreateIndex
CREATE INDEX "CourtBooking_referenceId_idx" ON "CourtBooking"("referenceId");

-- CreateIndex
CREATE INDEX "CourtSchedule_courtId_idx" ON "CourtSchedule"("courtId");

-- CreateIndex
CREATE INDEX "CourtSchedule_tenantId_idx" ON "CourtSchedule"("tenantId");

-- CreateIndex
CREATE INDEX "CourtSchedule_userEmail_idx" ON "CourtSchedule"("userEmail");

-- CreateIndex
CREATE INDEX "CourtSchedule_isVacant_idx" ON "CourtSchedule"("isVacant");

-- CreateIndex
CREATE INDEX "CourtSchedule_referenceId_idx" ON "CourtSchedule"("referenceId");
