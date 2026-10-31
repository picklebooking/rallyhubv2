import { TenantRole } from '../generated/prisma/enums';

export interface ITenantMember<T> {
  message: string;
  content: T;
}

export interface ITenantGeneric {
  id: string;
  createdAt: Date;
  updatedAt: Date;
  userId: string;
  tenantId: string;
  venueId: string | null;
  role: TenantRole;
  isActive: boolean;
}
