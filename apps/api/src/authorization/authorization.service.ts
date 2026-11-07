import { ForbiddenException, Injectable } from '@nestjs/common';
import { ErrorConstant } from '../constants/error-code.constant';
import { AuthorizationRepository } from './authorization.repository';

@Injectable()
export class AuthorizationService {
  constructor(private readonly repository: AuthorizationRepository) {}

  async assertPlatformAdmin(userId: string): Promise<void> {
    if (await this.repository.isPlatformAdmin(userId)) return;
    throw new ForbiddenException(
      ErrorConstant.AUTHORIZATION_MESSAGES.FORBIDDEN,
    );
  }

  async assertCanEditTenant(userId: string, tenantId: string): Promise<void> {
    if (await this.repository.isPlatformAdmin(userId)) return;
    if (await this.repository.hasTenantOwnerMembership(userId, tenantId))
      return;
    throw new ForbiddenException(
      ErrorConstant.AUTHORIZATION_MESSAGES.FORBIDDEN,
    );
  }

  async assertCanCreateVenue(userId: string, tenantId: string): Promise<void> {
    if (await this.repository.isPlatformAdmin(userId)) return;
    if (await this.repository.hasTenantWideMembership(userId, tenantId)) return;
    throw new ForbiddenException(
      ErrorConstant.AUTHORIZATION_MESSAGES.FORBIDDEN,
    );
  }

  async assertCanManageVenue(
    userId: string,
    tenantId: string,
    venueId: string,
  ): Promise<void> {
    if (await this.repository.isPlatformAdmin(userId)) return;
    if (
      await this.repository.hasVenueManagerMembership(userId, tenantId, venueId)
    )
      return;
    throw new ForbiddenException(
      ErrorConstant.AUTHORIZATION_MESSAGES.FORBIDDEN,
    );
  }
}
