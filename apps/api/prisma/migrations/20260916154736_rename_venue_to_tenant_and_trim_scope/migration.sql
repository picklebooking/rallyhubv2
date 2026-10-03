/*
  Warnings:

  - You are about to drop the `Booking` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Court` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `PricingRule` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `TenantSchedule` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "Booking" DROP CONSTRAINT "Booking_courtId_fkey";

-- DropForeignKey
ALTER TABLE "Booking" DROP CONSTRAINT "Booking_tenantId_fkey";

-- DropForeignKey
ALTER TABLE "Booking" DROP CONSTRAINT "Booking_userId_fkey";

-- DropForeignKey
ALTER TABLE "Court" DROP CONSTRAINT "Court_tenantId_fkey";

-- DropForeignKey
ALTER TABLE "PricingRule" DROP CONSTRAINT "PricingRule_tenantId_fkey";

-- DropForeignKey
ALTER TABLE "TenantSchedule" DROP CONSTRAINT "TenantSchedule_tenantId_fkey";

-- DropTable
DROP TABLE "Booking";

-- DropTable
DROP TABLE "Court";

-- DropTable
DROP TABLE "PricingRule";

-- DropTable
DROP TABLE "TenantSchedule";

-- DropEnum
DROP TYPE "BookingStatus";

-- DropEnum
DROP TYPE "CourtStatus";

-- DropEnum
DROP TYPE "CourtType";
