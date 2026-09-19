/*
  Warnings:

  - Changed the type of `bookDate` on the `CourtBooking` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `bookedDate` on the `CourtSchedule` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `dateTimeVacant` on the `CourtSchedule` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- DropIndex
DROP INDEX "CourtBooking_id_idx";

-- AlterTable
ALTER TABLE "CourtBooking" DROP COLUMN "bookDate",
ADD COLUMN     "bookDate" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "CourtSchedule" DROP COLUMN "bookedDate",
ADD COLUMN     "bookedDate" TIMESTAMP(3) NOT NULL,
DROP COLUMN "dateTimeVacant",
ADD COLUMN     "dateTimeVacant" TIMESTAMP(3) NOT NULL;
