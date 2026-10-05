-- DropForeignKey
ALTER TABLE "CourtBooking" DROP CONSTRAINT "CourtBooking_tenantId_fkey";

-- AlterTable
ALTER TABLE "Tenant" ADD COLUMN     "tenantOwnerName" TEXT;

-- AddForeignKey
ALTER TABLE "CourtBooking" ADD CONSTRAINT "CourtBooking_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
