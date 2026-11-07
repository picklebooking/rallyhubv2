/*
  Warnings:

  - A unique constraint covering the columns `[userId,tenantId]` on the table `TenantMember` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "TenantMember_tenant_wide_key" ON "TenantMember"("userId", "tenantId") WHERE ("venueId" IS NULL);
