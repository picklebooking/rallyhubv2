import { jest } from '@jest/globals';
import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AuthorizationService } from '../authorization/authorization.service';
import { TenantStatus } from '../generated/prisma/enums';
import { ITenant } from '../interface/ITenant.interface';
import { TenantRepository } from './tenant.repository';
import { TenantService } from './tenant.service';

describe('TenantService', () => {
  let service: TenantService;

  const tenantRepository = {
    findById:
      jest.fn<
        (tenantId: string, status: TenantStatus) => Promise<ITenant | null>
      >(),
    create: jest.fn(),
  };

  const authorizationService = {
    assertPlatformAdmin: jest.fn<() => Promise<void>>(),
    assertCanEditTenant: jest.fn<() => Promise<void>>(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TenantService,
        { provide: AuthorizationService, useValue: authorizationService },
        {
          provide: TenantRepository,
          useValue: tenantRepository,
        },
      ],
    }).compile();

    service = module.get<TenantService>(TenantService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it.each(['status', 'delete', 'details'] as const)(
    'checks existence before permission for %s',
    async (operation) => {
      tenantRepository.findById.mockResolvedValue(null);
      const result =
        operation === 'status'
          ? service.updateTenantStatus('actor', 'missing', {
              status: TenantStatus.ACTIVE,
            })
          : operation === 'delete'
            ? service.deleteTenantById('actor', 'missing')
            : service.updateTenantData('actor', 'missing', {
                tenantName: 'Update',
              });
      await expect(result).rejects.toThrow(NotFoundException);
      expect(authorizationService.assertPlatformAdmin).not.toHaveBeenCalled();
      expect(authorizationService.assertCanEditTenant).not.toHaveBeenCalled();
    },
  );

  it('throws NotFoundException when the tenant does not exist', async () => {
    tenantRepository.findById.mockResolvedValue(null);

    await expect(
      service.findTenantById('missing-id', TenantStatus.ACTIVE, false),
    ).rejects.toThrow(NotFoundException);

    expect(tenantRepository.findById).toHaveBeenCalledWith(
      'missing-id',
      TenantStatus.ACTIVE,
    );
  });
});
