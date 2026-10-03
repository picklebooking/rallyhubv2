/*
  Warnings:

  - You are about to drop the column `venueId` on the `Booking` table. All the data in the column will be lost.
  - You are about to drop the column `venueId` on the `Court` table. All the data in the column will be lost.
  - You are about to drop the column `venueId` on the `PricingRule` table. All the data in the column will be lost.
  - You are about to drop the `Venue` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `VenueMember` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `VenueSchedule` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `tenantId` to the `Booking` table without a default value. This is not possible if the table is not empty.
  - Added the required column `tenantId` to the `Court` table without a default value. This is not possible if the table is not empty.
  - Added the required column `tenantId` to the `PricingRule` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "TenantStatus" AS ENUM ('PENDING', 'ACTIVE', 'SUSPENDED', 'INACTIVE');

-- CreateEnum
CREATE TYPE "TenantRole" AS ENUM ('OWNER', 'STAFF', 'CUSTOMER');

-- DropForeignKey
ALTER TABLE "Booking" DROP CONSTRAINT "Booking_venueId_fkey";

-- DropForeignKey
ALTER TABLE "Court" DROP CONSTRAINT "Court_venueId_fkey";

-- DropForeignKey
ALTER TABLE "PricingRule" DROP CONSTRAINT "PricingRule_venueId_fkey";

-- DropForeignKey
ALTER TABLE "VenueMember" DROP CONSTRAINT "VenueMember_userId_fkey";

-- DropForeignKey
ALTER TABLE "VenueMember" DROP CONSTRAINT "VenueMember_venueId_fkey";

-- DropForeignKey
ALTER TABLE "VenueSchedule" DROP CONSTRAINT "VenueSchedule_venueId_fkey";

-- DropIndex
DROP INDEX "Booking_venueId_createdAt_idx";

-- DropIndex
DROP INDEX "Booking_venueId_startTime_idx";

-- DropIndex
DROP INDEX "Booking_venueId_status_idx";

-- DropIndex
DROP INDEX "Court_venueId_idx";

-- DropIndex
DROP INDEX "Court_venueId_status_idx";

-- DropIndex
DROP INDEX "PricingRule_venueId_idx";

-- DropIndex
DROP INDEX "PricingRule_venueId_isActive_idx";

-- AlterTable
ALTER TABLE "Booking" DROP COLUMN "venueId",
ADD COLUMN     "tenantId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Court" DROP COLUMN "venueId",
ADD COLUMN     "tenantId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "PricingRule" DROP COLUMN "venueId",
ADD COLUMN     "tenantId" TEXT NOT NULL;

-- DropTable
DROP TABLE "Venue";

-- DropTable
DROP TABLE "VenueMember";

-- DropTable
DROP TABLE "VenueSchedule";

-- DropEnum
DROP TYPE "VenueRole";

-- DropEnum
DROP TYPE "VenueStatus";

-- CreateTable
CREATE TABLE "Tenant" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "status" "TenantStatus" NOT NULL DEFAULT 'PENDING',
    "address" TEXT,
    "city" TEXT,
    "state" TEXT,
    "zipCode" TEXT,
    "country" TEXT NOT NULL DEFAULT 'PH',
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Manila',
    "phone" TEXT,
    "email" TEXT,
    "website" TEXT,
    "logo" TEXT,
    "coverImage" TEXT,
    "primaryColor" TEXT,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Tenant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TenantMember" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "role" "TenantRole" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TenantMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TenantSchedule" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "dayOfWeek" INTEGER NOT NULL,
    "openTime" TEXT NOT NULL,
    "closeTime" TEXT NOT NULL,
    "isClosed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TenantSchedule_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Tenant_slug_key" ON "Tenant"("slug");

-- CreateIndex
CREATE INDEX "Tenant_slug_idx" ON "Tenant"("slug");

-- CreateIndex
CREATE INDEX "Tenant_status_idx" ON "Tenant"("status");

-- CreateIndex
CREATE INDEX "TenantMember_tenantId_idx" ON "TenantMember"("tenantId");

-- CreateIndex
CREATE INDEX "TenantMember_userId_idx" ON "TenantMember"("userId");

-- CreateIndex
CREATE INDEX "TenantMember_tenantId_role_idx" ON "TenantMember"("tenantId", "role");

-- CreateIndex
CREATE UNIQUE INDEX "TenantMember_userId_tenantId_key" ON "TenantMember"("userId", "tenantId");

-- CreateIndex
CREATE INDEX "TenantSchedule_tenantId_idx" ON "TenantSchedule"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "TenantSchedule_tenantId_dayOfWeek_key" ON "TenantSchedule"("tenantId", "dayOfWeek");

-- CreateIndex
CREATE INDEX "Booking_tenantId_startTime_idx" ON "Booking"("tenantId", "startTime");

-- CreateIndex
CREATE INDEX "Booking_tenantId_status_idx" ON "Booking"("tenantId", "status");

-- CreateIndex
CREATE INDEX "Booking_tenantId_createdAt_idx" ON "Booking"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "Court_tenantId_idx" ON "Court"("tenantId");

-- CreateIndex
CREATE INDEX "Court_tenantId_status_idx" ON "Court"("tenantId", "status");

-- CreateIndex
CREATE INDEX "PricingRule_tenantId_idx" ON "PricingRule"("tenantId");

-- CreateIndex
CREATE INDEX "PricingRule_tenantId_isActive_idx" ON "PricingRule"("tenantId", "isActive");

-- AddForeignKey
ALTER TABLE "TenantMember" ADD CONSTRAINT "TenantMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenantMember" ADD CONSTRAINT "TenantMember_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Court" ADD CONSTRAINT "Court_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PricingRule" ADD CONSTRAINT "PricingRule_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenantSchedule" ADD CONSTRAINT "TenantSchedule_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
