import { TenantStatus } from '../generated/prisma/enums';

export interface ITenant {
  email: string | null;
  phone: string | null;
  primaryColor: string | null;
  tenantOwnerName: string | null;
  id: string;
  name: string;
  status: TenantStatus;
  createdAt: Date;
  updatedAt: Date;
}
