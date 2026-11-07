/*
  Warnings:

  - The values [CUSTOMER] on the enum `TenantRole` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "TenantRole_new" AS ENUM ('OWNER', 'STAFF');
ALTER TABLE "TenantMember" ALTER COLUMN "role" TYPE "TenantRole_new" USING ("role"::text::"TenantRole_new");
ALTER TYPE "TenantRole" RENAME TO "TenantRole_old";
ALTER TYPE "TenantRole_new" RENAME TO "TenantRole";
DROP TYPE "public"."TenantRole_old";
COMMIT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "isPlatformAdmin" BOOLEAN NOT NULL DEFAULT false;
