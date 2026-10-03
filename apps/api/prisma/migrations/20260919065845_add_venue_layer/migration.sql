/*
  Warnings:

  - You are about to drop the column `address` on the `Tenant` table. All the data in the column will be lost.
  - You are about to drop the column `city` on the `Tenant` table. All the data in the column will be lost.
  - You are about to drop the column `country` on the `Tenant` table. All the data in the column will be lost.
  - You are about to drop the column `coverImage` on the `Tenant` table. All the data in the column will be lost.
  - You are about to drop the column `description` on the `Tenant` table. All the data in the column will be lost.
  - You are about to drop the column `logo` on the `Tenant` table. All the data in the column will be lost.
  - You are about to drop the column `slug` on the `Tenant` table. All the data in the column will be lost.
  - You are about to drop the column `state` on the `Tenant` table. All the data in the column will be lost.
  - You are about to drop the column `timezone` on the `Tenant` table. All the data in the column will be lost.
  - You are about to drop the column `website` on the `Tenant` table. All the data in the column will be lost.
  - You are about to drop the column `zipCode` on the `Tenant` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[userId,tenantId,venueId]` on the table `TenantMember` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `venueId` to the `Court` table without a default value. This is not possible if the table is not empty.
  - Added the required column `venueId` to the `CourtBooking` table without a default value. This is not possible if the table is not empty.
  - Added the required column `venueId` to the `CourtSchedule` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "VenueStatus" AS ENUM ('PENDING', 'ACTIVE', 'SUSPENDED', 'INACTIVE');

-- DropIndex
DROP INDEX "Court_tenantId_status_idx";

-- DropIndex
DROP INDEX "Tenant_slug_idx";

-- DropIndex
DROP INDEX "Tenant_slug_key";

-- DropIndex
DROP INDEX "TenantMember_userId_tenantId_key";

-- AlterTable
ALTER TABLE "Court" ADD COLUMN     "venueId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "CourtBooking" ADD COLUMN     "venueId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "CourtSchedule" ADD COLUMN     "venueId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Tenant" DROP COLUMN "address",
DROP COLUMN "city",
DROP COLUMN "country",
DROP COLUMN "coverImage",
DROP COLUMN "description",
DROP COLUMN "logo",
DROP COLUMN "slug",
DROP COLUMN "state",
DROP COLUMN "timezone",
DROP COLUMN "website",
DROP COLUMN "zipCode";

-- AlterTable
ALTER TABLE "TenantMember" ADD COLUMN     "venueId" TEXT;

-- CreateTable
CREATE TABLE "Venue" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "status" "VenueStatus" NOT NULL DEFAULT 'PENDING',
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
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Venue_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Venue_slug_key" ON "Venue"("slug");

-- CreateIndex
CREATE INDEX "Venue_tenantId_idx" ON "Venue"("tenantId");

-- CreateIndex
CREATE INDEX "Venue_slug_idx" ON "Venue"("slug");

-- CreateIndex
CREATE INDEX "Venue_status_idx" ON "Venue"("status");

-- CreateIndex
CREATE INDEX "Court_venueId_idx" ON "Court"("venueId");

-- CreateIndex
CREATE INDEX "Court_venueId_status_idx" ON "Court"("venueId", "status");

-- CreateIndex
CREATE INDEX "CourtBooking_venueId_idx" ON "CourtBooking"("venueId");

-- CreateIndex
CREATE INDEX "CourtSchedule_venueId_idx" ON "CourtSchedule"("venueId");

-- CreateIndex
CREATE UNIQUE INDEX "TenantMember_userId_tenantId_venueId_key" ON "TenantMember"("userId", "tenantId", "venueId");

-- AddForeignKey
ALTER TABLE "Venue" ADD CONSTRAINT "Venue_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Court" ADD CONSTRAINT "Court_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "Venue"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourtBooking" ADD CONSTRAINT "CourtBooking_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "Venue"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourtSchedule" ADD CONSTRAINT "CourtSchedule_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "Venue"("id") ON DELETE CASCADE ON UPDATE CASCADE;
